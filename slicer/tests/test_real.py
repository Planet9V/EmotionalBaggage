"""Runs the real OrcaSlicer. Skipped unless ORCA_BIN is the unpacked AppImage's AppRun and ORCA_PROFILES is the pinned profile tree.
The Docker image sets both; CI runs this file inside the built image (see .github/workflows/ci.yml, job slicer)."""
import io
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BIN = os.environ.get("ORCA_BIN", "")
ROOT = Path(os.environ.get("ORCA_PROFILES", "/opt/orca/profiles"))
pytestmark = [pytest.mark.real, pytest.mark.skipif(not (BIN and Path(BIN).exists() and (ROOT / "BBL").exists()), reason="the real OrcaSlicer is not installed here")]


def box(x, y, z, ox=0.0, oy=0.0, oz=0.0):
    v = [(0, 0, 0), (x, 0, 0), (x, y, 0), (0, y, 0), (0, 0, z), (x, 0, z), (x, y, z), (0, y, z)]
    v = [(a + ox, b + oy, c + oz) for a, b, c in v]
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
    return v, f


def stl(*boxes) -> bytes:
    out = ["solid t"]
    for v, f in boxes:
        for a, b, c in f:
            out.append("facet normal 0 0 0\n outer loop")
            out += [" vertex %g %g %g" % v[i] for i in (a, b, c)]
            out.append(" endloop\nendfacet")
    out.append("endsolid t")
    return "\n".join(out).encode()


CUBE = stl(box(20, 20, 20))
# a plinth with a wide slab above it: the slab overhangs on every side, so supports change the print
OVERHANG = stl(box(10, 10, 10, 15, 15, 0), box(40, 40, 6, 0, 0, 10))


@pytest.fixture(scope="module")
def client():
    from app import main
    return TestClient(main.app)


def go(client, body, maker, model, **form):
    data = {"maker": maker, "model": model, "material": "PLA", "layer_height": "0.2", "infill": "15", "supports": "false", **form}
    r = client.post("/slice", files={"file": ("part.stl", io.BytesIO(body), "application/octet-stream")}, data=data)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("maker,model", [("Bambu Lab", "A1"), ("Prusa Research", "MK4S")])
def test_a_cube_slices_with_a_print_time_and_material(client, maker, model):
    j = go(client, CUBE, maker, model)
    assert j["result"]["seconds"] > 60 and j["result"]["filamentG"] > 0.5 and j["result"]["filamentMm"] > 100
    g = client.get(j["files"]["gcode"]["url"])
    assert g.status_code == 200 and len(g.content) > 10_000 and b"G1" in g.content


def test_infill_changes_the_material(client):
    lo = go(client, CUBE, "Bambu Lab", "A1", infill="5")["result"]["filamentG"]
    hi = go(client, CUBE, "Bambu Lab", "A1", infill="60")["result"]["filamentG"]
    assert hi > lo * 1.3


def test_layer_height_changes_the_time(client):
    fine = go(client, CUBE, "Bambu Lab", "A1", layer_height="0.12")["result"]["seconds"]
    draft = go(client, CUBE, "Bambu Lab", "A1", layer_height="0.28")["result"]["seconds"]
    assert fine > draft


def test_supports_add_material_to_an_overhang(client):
    off = go(client, OVERHANG, "Bambu Lab", "A1", supports="false")["result"]
    on = go(client, OVERHANG, "Bambu Lab", "A1", supports="true")["result"]
    assert on["filamentG"] > off["filamentG"] and on["supportG"] > 0 and off["supportG"] == 0


def test_a_part_larger_than_the_plate_is_refused_with_the_slicers_words(client):
    r = client.post("/slice", files={"file": ("big.stl", io.BytesIO(stl(box(900, 900, 20))), "application/octet-stream")},
                    data={"maker": "Bambu Lab", "model": "A1", "material": "PLA", "layer_height": "0.2", "infill": "15", "supports": "false"})
    assert r.status_code == 422 and r.json()["detail"].startswith("OrcaSlicer could not slice")
