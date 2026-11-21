"""Builds OrcaSlicer's command line, runs it, and reads what it wrote. Nothing is estimated here: time, filament length and weight
come from the slicer's own files (plate_N.statistics.json, with the G-code header comments as the second source)."""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path

ORCA_BIN = os.environ.get("ORCA_BIN", "/opt/orca/AppRun")
# Optional prefix, for example "xvfb-run -a". The 2.5.0 command line slices with no display, so the default is none.
ORCA_WRAPPER = shlex.split(os.environ.get("ORCA_WRAPPER", ""))
RUN_TIMEOUT_S = int(os.environ.get("SLICER_TIMEOUT_S", "600"))


class SliceError(Exception):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass
class Settings:
    infill_percent: int = 15
    supports: bool = False


def build_args(*, model: Path, outdir: Path, datadir: Path, machine: Path, process: Path, filament: Path, settings: Settings, bin: str | None = None, wrapper: list[str] | None = None) -> list[str]:
    """The whole command. Setting flags go last so they outrank the presets (OrcaSlicer: command line first, then --load-settings)."""
    return [
        *(ORCA_WRAPPER if wrapper is None else wrapper),
        bin or ORCA_BIN,
        "--datadir", str(datadir),
        "--outputdir", str(outdir),
        "--load-settings", f"{machine};{process}",
        "--load-filaments", str(filament),
        "--slice", "1",
        "--export-statistics",
        "--export-3mf", "sliced.3mf",
        "--sparse-infill-density", f"{int(settings.infill_percent)}%",
        # a boolean flag takes its value after "=", not as a separate word (a separate "1" is read as a file name)
        f"--enable-support={1 if settings.supports else 0}",
        str(model),
    ]


@dataclass
class Reading:
    seconds: float
    filament_mm: float
    filament_g: float
    filament_cm3: float
    layers: int | None
    source: str
    support_g: float | None = None


def read_statistics(path: Path) -> Reading:
    d = json.loads(Path(path).read_text())
    s = d["summary"]
    fils = s.get("filaments") or []
    length = sum(float(f.get("length", 0)) for f in fils)
    weight = sum(float(f.get("weight", 0)) for f in fils)
    volume = sum(float(f.get("volume", 0)) for f in fils)
    sup = sum(float((f.get("support") or {}).get("weight", 0)) for f in fils)
    return Reading(float(s["time"]), length, weight, volume / 1000.0, int(s["layer_count"]) if "layer_count" in s else None, "statistics.json", sup)


_DUR = re.compile(r"(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?")


def parse_duration(text: str) -> float:
    m = _DUR.fullmatch(text.strip())
    if not m or not any(m.groups()):
        raise ValueError(f"not a duration: {text!r}")
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return float(d * 86400 + h * 3600 + mi * 60 + s)


def read_gcode_header(text: str) -> Reading:
    """The second source: the comments OrcaSlicer writes into the G-code. Bambu profiles write 'total estimated time: 19m 51s';
    others write 'estimated printing time (normal mode) = 14m 23s'."""
    secs = None
    m = re.search(r"total estimated time:\s*([0-9dhms ]+)", text)
    if m:
        secs = parse_duration(m.group(1))
    else:
        m = re.search(r"estimated printing time \(normal mode\)\s*=\s*([0-9dhms ]+)", text)
        if m:
            secs = parse_duration(m.group(1))

    def num(label: str) -> float | None:
        mm = re.search(rf"filament used \[{label}\]\s*=\s*([0-9.]+)", text)
        return float(mm.group(1)) if mm else None

    mm_, g, cm3 = num("mm"), num("g"), num("cm3")
    if secs is None or mm_ is None or g is None:
        raise SliceError("The slicer wrote no print time or filament use that could be read.", 502)
    return Reading(secs, mm_, g, cm3 or 0.0, None, "gcode header")


def read_result(path: Path) -> dict:
    return json.loads(Path(path).read_text())


def run(args: list[str], cwd: Path, timeout: int = RUN_TIMEOUT_S) -> subprocess.CompletedProcess:
    env = {**os.environ, "HOME": str(cwd), "XDG_RUNTIME_DIR": os.environ.get("XDG_RUNTIME_DIR", str(cwd))}
    try:
        return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise SliceError(f"Slicing took longer than {timeout} seconds and was stopped.", 504)
    except FileNotFoundError:
        raise SliceError("The slicer program is not installed in this container.", 503)


def slice_job(model: Path, jobdir: Path, machine: Path, process: Path, filament: Path, settings: Settings) -> dict:
    out = jobdir / "out"
    data = jobdir / "data"
    out.mkdir(exist_ok=True)
    data.mkdir(exist_ok=True)
    args = build_args(model=model, outdir=out, datadir=data, machine=machine, process=process, filament=filament, settings=settings)
    proc = run(args, jobdir)
    result = {}
    if (out / "result.json").exists():
        result = read_result(out / "result.json")
    if proc.returncode != 0 or result.get("return_code", 0) != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()
        why = (result.get("error_string") or "").strip() or (tail[-1] if tail else "")
        raise SliceError(f"OrcaSlicer could not slice this file: {why or 'no reason given'}", 422)
    gcodes = sorted(out.glob("plate_*.gcode"))
    if not gcodes:
        raise SliceError("OrcaSlicer finished without writing a G-code file.", 502)
    stats = out / "plate_1.statistics.json"
    if stats.exists():
        reading = read_statistics(stats)
    else:
        reading = read_gcode_header(gcodes[0].read_text(errors="replace"))
    warnings = [w for w in (result.get("warnings") or [])]
    return {"reading": reading, "gcode": gcodes[0], "project": out / "sliced.3mf" if (out / "sliced.3mf").exists() else None,
            "statistics": stats if stats.exists() else None, "warnings": warnings}
