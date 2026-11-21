from pathlib import Path

import pytest

from app import orca, profiles


def args_for(root, table, maker, model, material="PLA", h=0.2, infill=15, supports=False):
    r = profiles.resolve(table, root, maker, model, material, h)
    return r, orca.build_args(model=Path("/j/model.stl"), outdir=Path("/j/out"), datadir=Path("/j/data"), machine=r.machine, process=r.process,
                              filament=r.filament, settings=orca.Settings(infill, supports), bin="/opt/orca/AppRun", wrapper=[])


def test_bambu_arguments(fake_tree):
    root, table = fake_tree
    r, a = args_for(root, table, "Bambu Lab", "A1", "PETG", 0.16, 30, True)
    assert a[0] == "/opt/orca/AppRun"
    assert a[a.index("--load-settings") + 1] == f"{r.machine};{r.process}"
    assert r.process.name == "0.16mm Optimal @BBL A1.json"
    assert a[a.index("--load-filaments") + 1].endswith("Bambu PETG Basic @BBL A1.json")
    assert "--slice" in a and a[a.index("--slice") + 1] == "1"
    assert "--export-statistics" in a
    assert "--sparse-infill-density" in a and a[a.index("--sparse-infill-density") + 1] == "30%"
    assert "--enable-support=1" in a
    assert a[-1] == "/j/model.stl"


def test_prusa_uses_the_library_filament(fake_tree):
    root, table = fake_tree
    r, a = args_for(root, table, "Prusa Research", "MK4S")
    assert "OrcaFilamentLibrary" in str(r.filament)
    assert "--enable-support=0" in a
    assert a[a.index("--datadir") + 1] == "/j/data"


def test_setting_flags_come_after_presets(fake_tree):
    root, table = fake_tree
    _, a = args_for(root, table, "Bambu Lab", "A1")
    assert a.index("--load-settings") < a.index("--sparse-infill-density")


def test_maker_and_model_match_ignores_case(fake_tree):
    root, table = fake_tree
    assert profiles.resolve(table, root, "bambu lab", "a1", "pla", 0.2).machine_name == "Bambu Lab A1 0.4 nozzle"


@pytest.mark.parametrize("maker,model,material,h,word", [
    ("Bambu Lab", "H3C", "PLA", 0.2, "no machine profile"),
    ("Bambu Lab", "A1", "ABS", 0.2, "no ABS profile"),
    ("Bambu Lab", "A1", "PLA", 0.08, "0.08 mm layer height"),
    ("Nobody", "X", "PLA", 0.2, "no slicer profile"),
    ("Bambu Lab", "Z9", "PLA", 0.2, "no slicer profile"),
])
def test_refusals_say_why(fake_tree, maker, model, material, h, word):
    root, table = fake_tree
    with pytest.raises(profiles.ProfileError) as e:
        profiles.resolve(table, root, maker, model, material, h)
    assert word in e.value.message and e.value.status == 422


def test_catalogue_lists_unavailable_models_with_a_reason(fake_tree):
    _, table = fake_tree
    rows = {(r["maker"], r["model"]): r for r in profiles.catalogue(table)}
    assert rows[("Bambu Lab", "H3C")]["available"] is False and rows[("Bambu Lab", "H3C")]["reason"]
    assert rows[("Bambu Lab", "A1")]["layerHeights"] == [0.16, 0.2]
