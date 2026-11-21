import json
import os
import stat
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

FIX = Path(__file__).resolve().parent / "fixtures"
REAL_PROFILES = Path(os.environ.get("ORCA_PROFILES", "/opt/orca/profiles"))

# A stand-in for the orca binary: records its arguments, writes the files the real one writes (the contents are real OrcaSlicer
# output captured on 21 Nov 2026, see fixtures/), and exits 0. Tests that use it say so; the real run is test_real.py.
FAKE = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
a = sys.argv[1:]
out = Path(a[a.index("--outputdir") + 1])
fix = Path(__file__).with_name("fixtures")
which = "prusa_mk4s_cube" if "MK4S" in " ".join(a) else "bambu_a1_cube"
(out / "..").resolve().joinpath("args.json").write_text(json.dumps(a))
if os.environ.get("FAKE_FAIL"):
    (out / "result.json").write_text(json.dumps({"return_code": -43, "error_string": "The object is too big for the plate."}))
    sys.exit(7)
out.mkdir(exist_ok=True)
(out / "result.json").write_text((fix / f"{which}.result.json").read_text())
(out / "plate_1.statistics.json").write_text((fix / f"{which}.statistics.json").read_text())
(out / "plate_1.gcode").write_text((fix / f"{which}.gcode.txt").read_text())
(out / "sliced.3mf").write_bytes(b"PK-fake")
'''


@pytest.fixture
def fake_orca(tmp_path):
    d = tmp_path / "bin"
    d.mkdir()
    (d / "fixtures").symlink_to(FIX)
    p = d / "orca"
    p.write_text(FAKE)
    p.chmod(p.stat().st_mode | stat.S_IEXEC)
    return p


@pytest.fixture
def fake_tree(tmp_path):
    """A small profile tree with the shape of resources/profiles: one Bambu and one Prusa printer."""
    root = tmp_path / "profiles"

    def put(vendor, kind, name, **extra):
        f = root / vendor / kind / f"{name}.json"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps({"name": name, "type": kind, "from": "system", **extra}))

    put("BBL", "machine", "Bambu Lab A1 0.4 nozzle")
    put("BBL", "process", "0.20mm Standard @BBL A1")
    put("BBL", "process", "0.16mm Optimal @BBL A1")
    put("BBL", "filament", "Bambu PLA Basic @BBL A1")
    put("BBL", "filament", "Bambu PETG Basic @BBL A1")
    put("Prusa", "machine", "Prusa MK4S 0.4 nozzle")
    put("Prusa", "process", "0.20mm SPEED @MK4S 0.4")
    put("OrcaFilamentLibrary", "filament", "Generic PLA @System")
    table = {
        "orca": {"version": "2.5.0", "tag": "v2.5.0", "commit": "x"},
        "materials": ["PLA", "PETG"],
        "printers": {
            "Bambu Lab": {
                "A1": {"vendor": "BBL", "orcaMachine": "Bambu Lab A1 0.4 nozzle", "profile": True, "note": "",
                       "process": {"0.20": "0.20mm Standard @BBL A1", "0.16": "0.16mm Optimal @BBL A1"},
                       "filament": {"PLA": "Bambu PLA Basic @BBL A1", "PETG": "Bambu PETG Basic @BBL A1"}},
                "H3C": {"vendor": "BBL", "orcaMachine": None, "profile": None, "reason": "OrcaSlicer 2.5.0 ships no machine profile for this model."},
            },
            "Prusa Research": {
                "MK4S": {"vendor": "Prusa", "orcaMachine": "Prusa MK4S 0.4 nozzle", "profile": True, "note": "",
                        "process": {"0.20": "0.20mm SPEED @MK4S 0.4"}, "filament": {"PLA": "Generic PLA @System"}},
            },
        },
    }
    return root, table
