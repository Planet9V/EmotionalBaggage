#!/usr/bin/env python3
"""Writes slicer/profiles.json from OrcaSlicer's own profile tree.

    python3 slicer/tools/gen_profiles.py <path to resources/profiles> > slicer/profiles.json

The tree is the `resources/profiles` folder of the pinned OrcaSlicer tag (see ORCA_VERSION in the Dockerfile). Nothing in the
output is typed by hand except SEEDS below, which says which Orca machine preset stands for which printer model of the app's
list. Every preset name written to the file is looked up in the tree first; a model whose machine preset is not in the tree is
written with "profile": null and the reason, never guessed.

The keys are the app's own maker and model strings (src/lib/printers/models.ts on the printers branch), so the two lists join
without a translation table. Run again after bumping the pinned version; `slicer/tests/test_profiles.py` fails when a name in
profiles.json is not in the tree.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "PC", "PA"]
# Which filament words stand for a material, in the order tried.
MATERIAL_WORDS = {
    "PLA": ["PLA Basic", "PLA"],
    "PETG": ["PETG Basic", "PETG"],
    "ABS": ["ABS"],
    "ASA": ["ASA"],
    "TPU": ["TPU 95A", "TPU"],
    "PC": ["PC"],
    "PA": ["PA"],
}
# Which process word is preferred at one layer height when a vendor has several.
WORD_PRIORITY = ["standard", "quality", "optimal", "balanced", "speed", "fine", "draft", "detail", "structural", "strength", "extra draft", "extra fine", "high quality", "fast detail"]

# (maker, model as the app lists it, Orca vendor folder, Orca machine preset name or None, note)
SEEDS: list[tuple[str, str, str, str | None, str]] = [
    ("Bambu Lab", "A1 mini", "BBL", "Bambu Lab A1 mini 0.4 nozzle", ""),
    ("Bambu Lab", "A1", "BBL", "Bambu Lab A1 0.4 nozzle", ""),
    ("Bambu Lab", "A2L", "BBL", "Bambu Lab A2L 0.4 nozzle", ""),
    ("Bambu Lab", "P1P", "BBL", "Bambu Lab P1P 0.4 nozzle", ""),
    ("Bambu Lab", "P1S", "BBL", "Bambu Lab P1S 0.4 nozzle", ""),
    ("Bambu Lab", "P2S", "BBL", "Bambu Lab P2S 0.4 nozzle", ""),
    ("Bambu Lab", "X1 Carbon", "BBL", "Bambu Lab X1 Carbon 0.4 nozzle", ""),
    ("Bambu Lab", "X1E", "BBL", "Bambu Lab X1E 0.4 nozzle", ""),
    ("Bambu Lab", "X2D", "BBL", "Bambu Lab X2D 0.4 nozzle", ""),
    ("Bambu Lab", "H2D", "BBL", "Bambu Lab H2D 0.4 nozzle", "Sliced for the left nozzle and one filament."),
    ("Bambu Lab", "H2D Pro", "BBL", "Bambu Lab H2D Pro 0.4 nozzle", "Sliced for the left nozzle and one filament."),
    ("Bambu Lab", "H2S", "BBL", "Bambu Lab H2S 0.4 nozzle", ""),
    ("Bambu Lab", "H2C", "BBL", "Bambu Lab H2C 0.4 nozzle", "Sliced for one nozzle and one filament."),
    ("Bambu Lab", "H3C", "BBL", None, ""),
    ("Prusa Research", "CORE One+", "Prusa", "Prusa CORE One 0.4 nozzle", "Orca's profile is for the CORE One."),
    ("Prusa Research", "CORE One L+", "Prusa", "Prusa CORE One L 0.4 nozzle", "Orca's profile is for the CORE One L."),
    ("Prusa Research", "MK4S", "Prusa", "Prusa MK4S 0.4 nozzle", ""),
    ("Prusa Research", "XL+", "Prusa", "Prusa XL 0.4 nozzle", "Orca's profile is for the single-toolhead XL."),
    ("Prusa Research", "MINI+", "Prusa", "Prusa MINI 0.4 nozzle", "Orca's profile is for the MINI."),
    ("Sovol", "SV08", "Sovol", "Sovol SV08 0.4 nozzle", ""),
    ("QIDI", "Plus4", "Qidi", "Qidi X-Plus 4 0.4 nozzle", "Orca names this machine X-Plus 4."),
    ("QIDI", "Q2", "Qidi", "Qidi Q2 0.4 nozzle", ""),
    ("QIDI", "Max4", "Qidi", "Qidi X-Max 4 0.4 nozzle", "Orca names this machine X-Max 4."),
    ("QIDI", "Plus5", "Qidi", "Qidi X-Plus 5 0.4 nozzle", "Orca names this machine X-Plus 5."),
    ("Creality", "K1", "Creality", "Creality K1 (0.4 nozzle)", ""),
    ("Creality", "K1C", "Creality", "Creality K1C 0.4 nozzle", ""),
    ("Creality", "K1 Max", "Creality", "Creality K1 Max (0.4 nozzle)", ""),
    ("Creality", "K1, K1C and K1 Max", "Creality", "Creality K1 (0.4 nozzle)", "The app lists three machines as one entry; this is the K1 profile. Use the K1 Max entry for that machine."),
    ("Creality", "Hi", "Creality", "Creality Hi 0.4 nozzle", ""),
    ("Elegoo", "Neptune 4 Plus", "Elegoo", "Elegoo Neptune 4 Plus (0.4 nozzle)", ""),
    ("Elegoo", "Centauri Carbon 2", "Elegoo", "Elegoo Centauri Carbon 2 0.4 nozzle", ""),
    ("Elegoo", "Centauri 2", "Elegoo", None, ""),
    ("Anycubic", "Kobra S1 Max", "Anycubic", "Anycubic Kobra S1 Max 0.4 nozzle", ""),
    ("Anycubic", "Kobra X", "Anycubic", "Anycubic Kobra X 0.4 nozzle", ""),
    ("Anycubic", "Kobra 3 Max V2", "Anycubic", None, ""),
    ("Anycubic", "Kobra 4", "Anycubic", None, ""),
    ("FlashForge", "Adventurer 5M", "Flashforge", "Flashforge Adventurer 5M 0.4 Nozzle", ""),
]


def index(root: Path, vendor: str) -> dict[str, tuple[str, dict]]:
    """name -> (kind, json) for every preset in a vendor folder."""
    out: dict[str, tuple[str, dict]] = {}
    for kind in ("machine", "process", "filament"):
        for f in sorted((root / vendor / kind).rglob("*.json")):
            try:
                d = json.loads(f.read_text())
            except Exception:
                continue
            if isinstance(d, dict) and d.get("name"):
                out[d["name"]] = (kind, d)
    return out


def resolved(idx: dict, name: str, key: str):
    """A key of a preset, following `inherits` upward."""
    seen = set()
    while name and name not in seen and name in idx:
        seen.add(name)
        d = idx[name][1]
        if key in d:
            return d[key]
        name = d.get("inherits", "")
    return None


def alt_machine_names(machine: str) -> list[str]:
    """Orca spells the 0.4 mm nozzle a few ways; try the others before giving up."""
    m = re.match(r"^(.*?)[ ]?\(?0\.4[ ]nozzle\)?$", machine, re.I)
    stem = m.group(1) if m else machine
    return [machine, f"{stem} 0.4 nozzle", f"{stem} (0.4 nozzle)", f"{stem} 0.4 Nozzle", f"{stem} 0.4mm nozzle"]


def build(root: Path) -> dict:
    lib = index(root, "OrcaFilamentLibrary")
    vendors: dict[str, dict] = {}
    printers: dict[str, dict] = {}
    for maker, model, vendor, machine, note in SEEDS:
        entry: dict = {"vendor": vendor, "orcaMachine": None, "note": note}
        printers.setdefault(maker, {})[model] = entry
        if machine is None:
            entry["profile"] = None
            entry["reason"] = "OrcaSlicer 2.5.0 ships no machine profile for this model."
            continue
        idx = vendors.setdefault(vendor, index(root, vendor))
        found = next((n for n in alt_machine_names(machine) if n in idx and idx[n][0] == "machine"), None)
        if not found:
            entry["profile"] = None
            entry["reason"] = f'OrcaSlicer 2.5.0 has no machine preset named "{machine}".'
            continue
        entry["orcaMachine"] = found
        default_proc = resolved(idx, found, "default_print_profile") or ""
        default_fil = resolved(idx, found, "default_filament_profile")
        if isinstance(default_fil, list):
            default_fil = default_fil[0] if default_fil else ""
        default_fil = default_fil or ""

        m = re.match(r"^(\d\.\d\d)mm (.+?) (@.*)$", default_proc)
        process: dict[str, str] = {}
        if m:
            suffix = m.group(3)
            best: dict[str, tuple[int, str]] = {}
            for n, (kind, _d) in idx.items():
                if kind != "process":
                    continue
                pm = re.match(r"^(\d\.\d\d)mm (.+?) (@.*)$", n)
                if not pm or pm.group(3) != suffix:
                    continue
                word = pm.group(2).lower()
                rank = WORD_PRIORITY.index(word) if word in WORD_PRIORITY else 99
                if n == default_proc:
                    rank = -1
                h = pm.group(1)
                if h not in best or rank < best[h][0]:
                    best[h] = (rank, n)
            process = {h: best[h][1] for h in sorted(best) if best[h][0] < 99}
        elif default_proc in idx:
            h = re.match(r"^(\d\.\d\d)", default_proc)
            process = {h.group(1) if h else "0.20": default_proc}
        entry["defaultProcess"] = default_proc if default_proc in idx else None
        entry["process"] = process

        fm = re.match(r"^.*?(@.*)$", default_fil)
        fsuffix = fm.group(1) if fm else ""
        filament: dict[str, str] = {}
        for mat in MATERIALS:
            names = []
            vendor_prefix = "Bambu " if vendor == "BBL" else ""
            for word in MATERIAL_WORDS[mat]:
                if fsuffix:
                    names.append(f"{vendor_prefix}{word} {fsuffix}")
                    names.append(f"Generic {word} {fsuffix}")
            hit = next((n for n in names if n in idx and idx[n][0] == "filament"), None)
            if hit:
                filament[mat] = hit
                continue
            lib_hit = next((n for n in (f"Generic {w} @System" for w in MATERIAL_WORDS[mat]) if n in lib), None)
            if lib_hit:
                filament[mat] = lib_hit
        entry["filament"] = filament
        entry["defaultFilament"] = default_fil if default_fil in idx else None
        entry["profile"] = bool(process and filament)
        if not entry["profile"]:
            entry["reason"] = "The machine preset exists but no process or filament preset could be matched to it."
    return {
        "source": "OrcaSlicer resources/profiles, generated by slicer/tools/gen_profiles.py. Do not edit by hand; edit SEEDS and run it again.",
        "orca": {"version": "2.5.0", "tag": "v2.5.0", "commit": "40ecc66f78ed72dc368e0c1ebe40d77f00cc8a19"},
        "materials": MATERIALS,
        "printers": printers,
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: gen_profiles.py <resources/profiles>")
    print(json.dumps(build(Path(sys.argv[1])), indent=2, ensure_ascii=False))
