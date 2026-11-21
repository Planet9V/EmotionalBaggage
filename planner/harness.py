"""Harness drawing for a concept's wiring, through WireViz.

WireViz is GPL-3.0. It is used here as a separate program: this module writes a YAML file,
runs the `wireviz` command in a child process, and reads the files it wrote. It never imports
WireViz. Keep it that way: the licence of the planner does not depend on it.

The request is plain data (connectors with pins, wires between pins). The YAML is written with
PyYAML's safe dumper, so a part title or a pin name can never become YAML syntax or a command.
Every wire becomes a one-wire cable, so each keeps its own colour and length on the drawing.
"""
from __future__ import annotations

import csv
import io
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, model_validator

# Our colour names to WireViz colour codes (IEC 60757). Anything else is left out of the drawing.
COLOUR_CODE = {
    "red": "RD", "black": "BK", "yellow": "YE", "green": "GN", "blue": "BU",
    "white": "WH", "orange": "OG", "purple": "VT", "brown": "BN", "grey": "GY", "gray": "GY",
}

RUN_SECONDS = 20.0
MAX_CONNECTORS = 200
MAX_WIRES = 1000


class Connector(BaseModel):
    ref: str = Field(min_length=1, max_length=40)
    title: str = Field(default="", max_length=120)
    # pin names the part has; wires may name others, which are added
    pins: list[str] = Field(default_factory=list, max_length=400)


class Wire(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    from_ref: str = Field(alias="from", min_length=1, max_length=40)
    from_pin: str = Field(default="", alias="fromPin", max_length=60)
    to_ref: str = Field(alias="to", min_length=1, max_length=40)
    to_pin: str = Field(default="", alias="toPin", max_length=60)
    colour: str = Field(default="", max_length=20)
    net: str = Field(default="", max_length=120)
    via: str = Field(default="", max_length=40)
    gauge: str = Field(default="", max_length=30)
    length_mm: float | None = Field(default=None, ge=0, le=100000, alias="lengthMm")

    model_config = {"populate_by_name": True}


class HarnessRequest(BaseModel):
    title: str = Field(default="Harness", max_length=120)
    connectors: list[Connector] = Field(default_factory=list, max_length=MAX_CONNECTORS)
    wires: list[Wire] = Field(min_length=1, max_length=MAX_WIRES)

    @model_validator(mode="after")
    def known_ends(self):
        refs: set[str] = set()
        for c in self.connectors:
            if c.ref in refs:
                raise ValueError(f"connector {c.ref!r} appears more than once")
            refs.add(c.ref)
        ids: set[str] = set()
        for w in self.wires:
            if w.id in ids:
                raise ValueError(f"wire id {w.id!r} appears more than once")
            ids.add(w.id)
            for r in (w.from_ref, w.to_ref):
                if r not in refs:
                    raise ValueError(f"wire {w.id!r} names {r!r}, which is not in the connectors")
        return self


class HarnessError(Exception):
    """A problem to show the user. `status` is the HTTP status the service answers with."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _pin_table(req: HarnessRequest) -> dict[str, list[str]]:
    """Pin names per connector, declared ones first and then any a wire names, in order of appearance."""
    pins: dict[str, list[str]] = {c.ref: [] for c in req.connectors}

    def add(ref: str, name: str):
        label = name.strip() or "?"
        if label not in pins[ref]:
            pins[ref].append(label)

    for c in req.connectors:
        for p in c.pins:
            if p.strip():
                add(c.ref, p)
    for w in req.wires:
        add(w.from_ref, w.from_pin)
        add(w.to_ref, w.to_pin)
    return pins


def build_yaml(req: HarnessRequest) -> str:
    """The WireViz input for a request. Pure: no files, no processes."""
    pins = _pin_table(req)
    used = {r for w in req.wires for r in (w.from_ref, w.to_ref)}
    connectors: dict[str, dict] = {}
    for c in req.connectors:
        if c.ref not in used:
            continue
        labels = pins[c.ref]
        entry: dict = {"pincount": len(labels), "pinlabels": labels}
        if c.title:
            entry["type"] = c.title
        connectors[c.ref] = entry

    cables: dict[str, dict] = {}
    connections: list[list[dict]] = []
    for i, w in enumerate(req.wires, start=1):
        name = f"W{i}"
        cable: dict = {"wirecount": 1}
        code = COLOUR_CODE.get(w.colour.strip().lower())
        if code:
            cable["colors"] = [code]
        if w.gauge.strip():
            cable["gauge"] = w.gauge.strip()
        if w.length_mm is not None:
            cable["length"] = f"{round(w.length_mm, 1)} mm"
        notes = " ".join(x for x in (w.net and f"net {w.net}", w.via and f"via {w.via}") if x)
        if notes:
            cable["notes"] = notes
        cables[name] = cable
        a = pins[w.from_ref].index(w.from_pin.strip() or "?") + 1
        b = pins[w.to_ref].index(w.to_pin.strip() or "?") + 1
        connections.append([{w.from_ref: [a]}, {name: [1]}, {w.to_ref: [b]}])

    doc = {
        "metadata": {"title": req.title},
        "connectors": connectors,
        "cables": cables,
        "connections": connections,
    }
    return yaml.safe_dump(doc, sort_keys=False, allow_unicode=True, default_flow_style=None)


def _bom(tsv: str) -> list[dict]:
    rows = list(csv.reader(io.StringIO(tsv), delimiter="\t"))
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        return []
    head = [h.strip() for h in rows[0]]
    return [dict(zip(head, r)) for r in rows[1:]]


def render(req: HarnessRequest, seconds: float = RUN_SECONDS) -> dict:
    """Runs WireViz on the request and returns the SVG, the bill of materials and the YAML used."""
    exe = shutil.which("wireviz")
    if not exe:
        raise HarnessError(503, "WireViz is not installed in the planner, so the harness cannot be drawn.")
    text = build_yaml(req)
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="harness-") as tmp:
        src = Path(tmp) / "harness.yml"
        src.write_text(text, encoding="utf-8")
        try:
            done = subprocess.run(
                [exe, "-f", "st", str(src)],
                cwd=tmp,
                capture_output=True,
                text=True,
                timeout=seconds,
                env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": tmp, "LANG": "C.UTF-8"},
            )
        except subprocess.TimeoutExpired:
            raise HarnessError(504, f"WireViz did not finish within {seconds:g} seconds.") from None
        if done.returncode != 0:
            tail = (done.stderr or done.stdout or "").strip().splitlines()[-3:]
            raise HarnessError(422, "WireViz could not draw this harness: " + " ".join(tail)[:400])
        svg_path = Path(tmp) / "harness.svg"
        bom_path = Path(tmp) / "harness.bom.tsv"
        if not svg_path.exists():
            raise HarnessError(422, "WireViz finished without writing a drawing.")
        svg = svg_path.read_text(encoding="utf-8")
        bom = _bom(bom_path.read_text(encoding="utf-8")) if bom_path.exists() else []
    return {
        "svg": svg,
        "bom": bom,
        "yaml": text,
        "seconds": round(time.monotonic() - started, 3),
        "wireviz": _version(exe),
    }


def _version(exe: str) -> str:
    try:
        out = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return ""
    return out.strip().splitlines()[-1] if out.strip() else ""
