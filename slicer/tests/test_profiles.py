"""profiles.json against OrcaSlicer's own tree. Runs when ORCA_PROFILES points at resources/profiles of the pinned tag."""
import os
from pathlib import Path

import pytest

from app import profiles

ROOT = Path(os.environ.get("ORCA_PROFILES", "/opt/orca/profiles"))
pytestmark = pytest.mark.skipif(not (ROOT / "BBL").exists(), reason="the OrcaSlicer profile tree is not present (set ORCA_PROFILES)")


def test_every_listed_preset_exists_in_the_tree():
    table = profiles.load_table()
    checked = 0
    for maker, models in table["printers"].items():
        for model, e in models.items():
            if not e.get("profile"):
                continue
            for mat in e["filament"]:
                for h in e["process"]:
                    profiles.resolve(table, ROOT, maker, model, mat, float(h))
                    checked += 1
    assert checked > 500


def test_bambu_a1_and_prusa_mk4s_resolve_to_real_files():
    t = profiles.load_table()
    a = profiles.resolve(t, ROOT, "Bambu Lab", "A1", "PLA", 0.2)
    assert a.machine.name == "Bambu Lab A1 0.4 nozzle.json" and a.process.name == "0.20mm Standard @BBL A1.json"
    b = profiles.resolve(t, ROOT, "Prusa Research", "MK4S", "PLA", 0.2)
    assert b.machine.exists() and b.filament.exists()
