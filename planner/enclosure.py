"""Enclosure generator 2 (plan 5.8): YAPP_Box, run by OpenSCAD in this container.

The web app sends the box-frame spec (see src/lib/enclosure/boxspec.ts): Z up, origin at the outer
bottom corner, X along the first side, Y along the second. This module writes a YAPP parameter file
from it, runs `openscad` headless with a time limit once for the base and once for the lid, checks the
two meshes, puts the lid back in its assembled place (YAPP prints it upside down, beside the base) and
returns both as binary STL with the .scad that produced them.

YAPP's faces in this frame (checked by `tests/test_enclosure.py` against the real output):
  YAPP back = -X, front = +X, left = -Y, right = +Y, lid = +Z, base = -Z.
The app's faces left/right/front/back are the box's -X/+X/-Y/+Y, so they map to YAPP back/front/left/right.
"""
from __future__ import annotations

import base64
import math
import re
import shutil
import struct
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

VENDOR = Path(__file__).parent / "vendor" / "yapp_box"
GENERATOR = "YAPPgenerator_v3.scad"
YAPP_VERSION = "YAPP_Box v3.3.8 (commit f9400c4)"
DEFAULT_TIMEOUT = 120.0

Face = Literal["left", "right", "front", "back", "top", "bottom"]


class _Spec(BaseModel):
    """Every number must be finite: NaN or Infinity is a 422, never a crash in the generator."""

    model_config = ConfigDict(allow_inf_nan=False)


class Opening(_Spec):
    face: Face
    shape: Literal["rect", "circle"]
    center: tuple[float, float, float]
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    label: str = ""


class Screw(_Spec):
    name: str
    clearance: float
    pin: float
    pilot: float = 1.8
    boss: float


class Hole(_Spec):
    x: float
    y: float
    diameter: float


class Standoffs(_Spec):
    holes: list[Hole]
    height: float
    pcbThickness: float


class PartBox(_Spec):
    ref: str
    min: tuple[float, float, float]
    max: tuple[float, float, float]


class BoxSpec(_Spec):
    outer: tuple[float, float, float]
    wall: float = Field(ge=0.8)
    floor: float = Field(ge=0.8)
    lid: float = Field(ge=0.8)
    cornerRadius: float = Field(ge=0)
    clearance: float = Field(ge=0)
    lidType: Literal["slip", "snap", "screw"]
    screw: Screw
    standoffs: Standoffs | None = None
    openings: list[Opening] = []
    parts: list[PartBox] = []


class EnclosureError(Exception):
    """OpenSCAD is missing, ran out of time or refused the file. The message is shown to the user."""


# ------------------------------------------------------------------ parameter file

def _num(v: float) -> str:
    return f"{v:.4f}".rstrip("0").rstrip(".") if v != int(v) else str(int(v))


def seam(spec: BoxSpec) -> tuple[float, float, float]:
    """Heights (mm) of the base wall, the lid wall and the ridge. The seam sits near the top so the lid is shallow."""
    inner_h = spec.outer[2] - spec.floor - spec.lid
    # YAPP refuses snap joins when the ridge is under 1.8 times the wall, so the ridge is always at least that.
    ridge = max(3.0, round(spec.wall * 1.8 + 0.1, 1))
    lid_wall = min(max(ridge + 1.0, spec.wall * 2, 4.0), inner_h / 2)
    return inner_h - lid_wall, lid_wall, ridge


def _gaps(length: float, blocked: list[tuple[float, float]], inset: float, need: float):
    """Free stretches along a wall, widest first, as (start, width)."""
    merged: list[list[float]] = []
    for a, b in sorted(blocked):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    out, cur = [], inset
    for a, b in merged:
        if a > cur:
            out.append((cur, a - cur))
        cur = max(cur, b)
    if length - inset > cur:
        out.append((cur, length - inset - cur))
    return sorted((g for g in out if g[1] >= need), key=lambda g: -g[1])


def _snap_positions(spec: BoxSpec):
    """One snap catch per long wall pair where a gap is free of parts and openings: (axis along wall, position)."""
    X, Y, Z = spec.outer
    w = spec.wall
    base_wall, _lid_wall, _ridge = seam(spec)
    seam_z = spec.floor + base_wall  # the catches sit on the ridge at the seam, so only what reaches this height can be in the way
    out = []
    # (wall name in YAPP, length along it, coordinate index along it, wall plane test)
    walls = {
        "yappBack": (Y, 1, lambda b: b[0] - w < 9),
        "yappFront": (Y, 1, lambda b: X - w - b[3] < 9),
        "yappLeft": (X, 0, lambda b: b[1] - w < 9),
        "yappRight": (X, 0, lambda b: Y - w - b[4] < 9),
    }
    wall_of_face = {"left": "yappBack", "right": "yappFront", "front": "yappLeft", "back": "yappRight"}
    for name, (length, ax, near) in walls.items():
        blocked: list[tuple[float, float]] = []
        for p in spec.parts:
            if p.max[2] < seam_z - 4:
                continue
            b = (p.min[0], p.min[1], 0.0, p.max[0], p.max[1])
            if near(b):
                blocked.append((p.min[ax] - 6, p.max[ax] + 6))
        for o in spec.openings:
            if wall_of_face.get(o.face) == name:
                c = o.center[ax]
                half = (o.width if ax == 1 else o.width) / 2
                blocked.append((c - half - 6, c + half + 6))
        g = _gaps(length, blocked, w + 8, 10)
        if g:
            start, width = g[0]
            out.append((name, ax, start + width / 2))
    return out


def scad_text(spec: BoxSpec, which: Literal["base", "lid", "both"] = "both") -> str:
    """The YAPP parameter file for a spec. It `include`s the generator, which must sit beside it."""
    X, Y, Z = spec.outer
    w = spec.wall
    base_wall, lid_wall, ridge = seam(spec)
    inner_x, inner_y = X - 2 * w, Y - 2 * w
    L: list[str] = []
    add = L.append
    add("// Written by concept to realization for the YAPP_Box generator (MIT, Willem Aandewiel).")
    add("// Put YAPPgenerator_v3.scad beside this file, open it in OpenSCAD and render (F6).")
    add("include <./YAPPgenerator_v3.scad>")
    add(f"printBaseShell = {'true' if which in ('base', 'both') else 'false'};")
    add(f"printLidShell = {'true' if which in ('lid', 'both') else 'false'};")
    add("printSwitchExtenders = false;")
    add("printDisplayClips = false;")
    # The "Main" PCB is the whole floor plan of the inside, so box coordinates and PCB coordinates agree.
    pcb_t = spec.standoffs.pcbThickness if spec.standoffs else 1.6
    stand_h = spec.standoffs.height if spec.standoffs else 1.0
    sc = spec.screw
    add(f"pcbLength = {_num(inner_x)};")
    add(f"pcbWidth = {_num(inner_y)};")
    add(f"pcbThickness = {_num(pcb_t)};")
    add(f"standoffHeight = {_num(stand_h)};")
    add(f"standoffDiameter = {_num(sc.boss)};")
    add(f"standoffPinDiameter = {_num(sc.pin)};")
    add("standoffHoleSlack = 0.4;")
    add('pcb = [["Main", pcbLength, pcbWidth, 0, 0, pcbThickness, standoffHeight, standoffDiameter, standoffPinDiameter, standoffHoleSlack]];')
    for k in ("paddingFront", "paddingBack", "paddingRight", "paddingLeft"):
        add(f"{k} = 0;")
    add(f"wallThickness = {_num(w)};")
    add(f"basePlaneThickness = {_num(spec.floor)};")
    add(f"lidPlaneThickness = {_num(spec.lid)};")
    add(f"baseWallHeight = {_num(base_wall)};")
    add(f"lidWallHeight = {_num(lid_wall)};")
    add(f"ridgeHeight = {_num(ridge)};")
    add("ridgeSlack = 0.3;")
    add("ridgeGap = 0.5;")
    add(f"roundRadius = {_num(spec.cornerRadius)};")
    add("boxType = 0;")
    add("printerLayerHeight = 0.2;")
    add("renderQuality = 12;")
    add("previewQuality = 5;")
    add("showSideBySide = true;")
    add("printMessages = false;")

    # PCB standoffs: each hole once, from the PCB origin (the inside corner), pins in the base and holes in the lid.
    stands = []
    if spec.standoffs:
        for h in spec.standoffs.holes:
            stands.append(f"[{_num(h.x - w)}, {_num(h.y - w)}, {_num(stand_h)}, undef, {_num(sc.boss)}, {_num(sc.pin)}, 0.4, 0, undef, yappBoth, yappPin, yappBackLeft, yappCoordPCB, yappNoFillet]")
    add("pcbStands = [" + ",\n  ".join(stands) + "];")

    conns = []
    if spec.lidType == "screw":
        # Four screw posts in the corners, clear of the standoffs' holes where there is room.
        # outside diameter must exceed the head diameter or YAPP leaves the head recess floating.
        outside = sc.boss + 2.0
        inset = outside / 2 - 0.4
        conns.append(
            f"[{_num(inset)}, {_num(inset)}, {_num(base_wall - 1)}, {_num(sc.clearance)}, {_num(sc.boss + 1)}, {_num(sc.pilot)}, {_num(outside)}, undef, 0, yappAllCorners, yappCoordBoxInside, yappSelfThreading, yappNoInternalFillet]"
        )
    add("connectors = [" + ",\n  ".join(conns) + "];")

    cut: dict[str, list[str]] = {k: [] for k in ("Base", "Lid", "Front", "Back", "Left", "Right")}
    for o in spec.openings:
        cx, cy, cz = o.center
        if o.face in ("left", "right"):
            key, p0, p1 = ("Back" if o.face == "left" else "Front"), cy, cz
        elif o.face in ("front", "back"):
            key, p0, p1 = ("Left" if o.face == "front" else "Right"), cx, cz
        else:
            key, p0, p1 = ("Lid" if o.face == "top" else "Base"), cx, cy
        if o.shape == "circle":
            item = f"[{_num(p0)}, {_num(p1)}, 0, 0, {_num(o.width / 2)}, yappCircle, 0, 0, yappCoordBox, yappCenter]"
        else:
            item = f"[{_num(p0)}, {_num(p1)}, {_num(o.width)}, {_num(o.height)}, 0, yappRectangle, 0, 0, yappCoordBox, yappCenter]"
        cut[key].append(item)
    for k in ("Base", "Lid", "Front", "Back", "Left", "Right"):
        add(f"cutouts{k} = [" + ",\n  ".join(cut[k]) + "];")

    snaps = []
    if spec.lidType == "snap":
        for name, _ax, pos in _snap_positions(spec):
            snaps.append(f"[{_num(pos)}, 8, {name}, yappCenter]")
    add("snapJoins = [" + ",\n  ".join(snaps) + "];")
    for k in ("boxMounts", "lightTubes", "pushButtons", "labelsPlane", "ridgeExtLeft", "ridgeExtRight", "ridgeExtFront", "ridgeExtBack", "displayMounts"):
        add(f"{k} = [];")
    add("YAPPgenerate();")
    return "\n".join(L) + "\n"


# ------------------------------------------------------------------ meshes

def parse_ascii_stl(text: str) -> list[tuple[tuple[float, float, float], ...]]:
    vs = [(float(a), float(b), float(c)) for a, b, c in re.findall(r"vertex\s+(\S+)\s+(\S+)\s+(\S+)", text)]
    if len(vs) % 3:
        raise EnclosureError("OpenSCAD wrote an STL with a facet that has fewer than three vertices.")
    return [tuple(vs[i : i + 3]) for i in range(0, len(vs), 3)]  # type: ignore[misc]


def write_binary_stl(tris, name: str = "yapp") -> bytes:
    out = bytearray(name.encode()[:79].ljust(80, b" "))
    out += struct.pack("<I", len(tris))
    for a, b, c in tris:
        u = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        v = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
        out += struct.pack("<12fH", n[0] / ln, n[1] / ln, n[2] / ln, *a, *b, *c, 0)
    return bytes(out)


def bbox(tris):
    xs = [p[0] for t in tris for p in t]
    ys = [p[1] for t in tris for p in t]
    zs = [p[2] for t in tris for p in t]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def watertight(tris) -> dict:
    """The planner's own check: after welding vertices, every edge belongs to exactly two triangles, one in each direction."""
    index: dict[tuple[int, int, int], int] = {}

    def vid(p):
        k = (round(p[0] * 1e4), round(p[1] * 1e4), round(p[2] * 1e4))
        return index.setdefault(k, len(index))

    edges: dict[tuple[int, int], int] = {}
    for t in tris:
        a, b, c = (vid(p) for p in t)
        if a == b or b == c or a == c:
            continue
        for u, v in ((a, b), (b, c), (c, a)):
            edges[(u, v)] = edges.get((u, v), 0) + 1
    bad = sum(1 for (u, v), n in edges.items() if n != 1 or edges.get((v, u), 0) != 1)
    return {"closed": bad == 0, "badEdges": bad, "triangles": len(tris)}


def _run(scad: Path, out: Path, timeout: float):
    exe = shutil.which("openscad")
    if not exe:
        raise EnclosureError("OpenSCAD is not installed in the planner container.")
    try:
        r = subprocess.run([exe, "-o", str(out), str(scad)], capture_output=True, text=True, timeout=timeout, cwd=scad.parent)
    except subprocess.TimeoutExpired:
        raise EnclosureError(f"OpenSCAD did not finish within {int(timeout)} seconds.") from None
    if r.returncode != 0 or not out.exists():
        tail = "\n".join((r.stderr or "").strip().splitlines()[-6:])
        raise EnclosureError(f"OpenSCAD refused the file: {tail or 'no message'}")


def generate(spec: BoxSpec, timeout: float = DEFAULT_TIMEOUT) -> dict:
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="yapp-") as d:
        work = Path(d)
        shutil.copy(VENDOR / GENERATOR, work / GENERATOR)
        meshes = {}
        for which in ("base", "lid"):
            f = work / f"{which}.scad"
            f.write_text(scad_text(spec, which))  # type: ignore[arg-type]
            _run(f, work / f"{which}.stl", max(5.0, timeout - (time.time() - t0)))
            meshes[which] = parse_ascii_stl((work / f"{which}.stl").read_text())
    X, Y, Z = spec.outer
    base = meshes["base"]
    # Lid: YAPP prints it upside down beside the base (a half turn about X). Turn it back and set it on the base.
    lid_print = meshes["lid"]
    (_, y0, _), (_, y1, _) = bbox(lid_print)
    lid = [tuple((p[0], y1 - p[1], Z - p[2]) for p in t) for t in lid_print]
    notes = []
    if spec.lidType == "screw":
        notes.append("Screwed lid: YAPP puts a screw post in each corner. They are not moved around parts, so the fit check says where one is in the way.")
    return {
        "version": YAPP_VERSION,
        "base_stl": base64.b64encode(write_binary_stl(base, "yapp base")).decode(),
        "lid_stl": base64.b64encode(write_binary_stl(lid, "yapp lid")).decode(),
        "scad": scad_text(spec, "both"),
        "seconds": round(time.time() - t0, 2),
        "notes": notes,
        "planner_check": {"base": watertight(base), "lid": watertight(lid)},
    }
