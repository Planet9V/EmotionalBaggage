"""Maps a printer model, material and layer height to OrcaSlicer's own preset files.

profiles.json (written by tools/gen_profiles.py from the pinned Orca tree) holds preset names. The files are found by scanning the
pinned tree once: every json file's "name" field is the key. Nothing here invents a setting; it only picks which Orca preset to load.
"""
from __future__ import annotations

import functools
import json
import os
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
PROFILES_JSON = Path(os.environ.get("SLICER_PROFILES_JSON", HERE / "profiles.json"))
LIBRARY = "OrcaFilamentLibrary"


class ProfileError(Exception):
    """A request the slicer cannot honour, with a sentence to show and the HTTP status to answer with."""

    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class Resolved:
    machine: Path
    process: Path
    filament: Path
    machine_name: str
    process_name: str
    filament_name: str
    layer_height: float
    note: str


def load_table(path: Path = PROFILES_JSON) -> dict:
    return json.loads(Path(path).read_text())


@functools.lru_cache(maxsize=64)
def scan(root: Path, vendor: str) -> dict[str, Path]:
    """preset name -> file, for one vendor folder under the profile root."""
    out: dict[str, Path] = {}
    for kind in ("machine", "process", "filament"):
        for f in sorted((root / vendor / kind).rglob("*.json")):
            try:
                name = json.loads(f.read_text()).get("name")
            except Exception:
                continue
            if name:
                out[name] = f
    return out


def _key(h: float) -> str:
    return f"{h:.2f}"


def entry(table: dict, maker: str, model: str) -> dict:
    ms = table["printers"].get(maker)
    if ms is None:
        # tolerate case and spacing differences in the maker or model text
        low = {k.lower(): k for k in table["printers"]}
        ms = table["printers"].get(low.get(maker.strip().lower(), ""))
    if ms is None:
        raise ProfileError(f'There is no slicer profile for the maker "{maker}".')
    e = ms.get(model)
    if e is None:
        low = {k.lower(): k for k in ms}
        e = ms.get(low.get(model.strip().lower(), ""))
    if e is None:
        raise ProfileError(f'There is no slicer profile for "{maker} {model}".')
    if not e.get("profile"):
        raise ProfileError(e.get("reason") or f'There is no slicer profile for "{maker} {model}".')
    return e


def resolve(table: dict, root: Path, maker: str, model: str, material: str, layer_height: float) -> Resolved:
    e = entry(table, maker, model)
    mat = material.strip().upper()
    fil_name = e["filament"].get(mat)
    if not fil_name:
        have = ", ".join(sorted(e["filament"])) or "none"
        raise ProfileError(f'OrcaSlicer has no {material} profile for {maker} {model}. It has: {have}.')
    proc_name = e["process"].get(_key(layer_height))
    if not proc_name:
        have = ", ".join(sorted(e["process"])) or "none"
        raise ProfileError(f"OrcaSlicer has no {layer_height} mm layer height profile for {maker} {model}. It has: {have}.")
    files = scan(root, e["vendor"])
    lib = scan(root, LIBRARY) if fil_name.endswith("@System") else {}
    paths = {}
    for label, name, pool in (("machine", e["orcaMachine"], files), ("process", proc_name, files), ("filament", fil_name, {**files, **lib})):
        p = pool.get(name)
        if p is None:
            raise ProfileError(f'The profile "{name}" is listed but not in the installed OrcaSlicer profiles.', 500)
        paths[label] = p
    return Resolved(paths["machine"], paths["process"], paths["filament"], e["orcaMachine"], proc_name, fil_name, layer_height, e.get("note", ""))


def catalogue(table: dict) -> list[dict]:
    """What the app may offer: every printer with a profile, its materials and layer heights."""
    rows = []
    for maker, models in table["printers"].items():
        for model, e in models.items():
            rows.append({
                "maker": maker,
                "model": model,
                "available": bool(e.get("profile")),
                "reason": e.get("reason", ""),
                "materials": sorted(e.get("filament", {})) if e.get("profile") else [],
                "layerHeights": sorted(float(h) for h in e.get("process", {})) if e.get("profile") else [],
                "note": e.get("note", ""),
            })
    return rows
