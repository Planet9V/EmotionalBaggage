"""YAPP_Box service (plan 5.8). The OpenSCAD run is skipped, with its reason, when OpenSCAD is not installed."""
import base64
import math
import shutil
import struct

import pytest
from fastapi.testclient import TestClient

import enclosure
from enclosure import BoxSpec, EnclosureError, generate, parse_ascii_stl, seam, watertight, write_binary_stl
from main import app

client = TestClient(app)
HAVE_OPENSCAD = shutil.which("openscad") is not None
needs_openscad = pytest.mark.skipif(not HAVE_OPENSCAD, reason="OpenSCAD is not installed on this machine")


def small(**kw):
    base = {
        "outer": [40, 30, 22],
        "wall": 2,
        "floor": 2,
        "lid": 2,
        "cornerRadius": 2,
        "clearance": 0.5,
        "lidType": "slip",
        "screw": {"name": "M2", "clearance": 2.4, "pin": 2, "pilot": 1.8, "boss": 4.4},
        "standoffs": None,
        # a round opening in the front wall (box frame: front is low Y), 8 mm across
        "openings": [{"face": "front", "shape": "circle", "center": [20, 0, 10], "width": 8, "height": 8, "label": "S1"}],
        "parts": [],
    }
    base.update(kw)
    return base


def tetra(flip=False):
    a, b, c, d = (0, 0, 0), (10, 0, 0), (0, 10, 0), (0, 0, 10)
    t = [(a, c, b), (a, b, d), (a, d, c), (b, c, d)]
    return [(x, z, y) for x, y, z in t] if flip else t


def test_seam_keeps_the_ridge_yapp_needs_for_snap_joins():
    s = BoxSpec(**small(wall=3))
    base_wall, lid_wall, ridge = seam(s)
    assert ridge >= 1.8 * 3
    assert base_wall + lid_wall == pytest.approx(s.outer[2] - s.floor - s.lid)
    assert lid_wall <= (s.outer[2] - s.floor - s.lid) / 2


def test_a_closed_solid_is_watertight_and_a_missing_face_is_not():
    assert watertight(tetra())["closed"] is True
    open_mesh = tetra()[:3]
    r = watertight(open_mesh)
    assert r["closed"] is False and r["badEdges"] > 0


def test_a_flipped_triangle_is_not_watertight():
    t = tetra()
    t[0] = (t[0][0], t[0][2], t[0][1])
    assert watertight(t)["closed"] is False


def test_binary_stl_round_trip_keeps_every_triangle():
    data = write_binary_stl(tetra(), "t")
    n = struct.unpack("<I", data[80:84])[0]
    assert n == 4 and len(data) == 84 + 50 * 4


def test_ascii_stl_with_a_short_facet_is_refused():
    with pytest.raises(EnclosureError):
        parse_ascii_stl("vertex 0 0 0\nvertex 1 0 0\n")


def test_the_parameter_file_names_the_opening_on_the_front_wall():
    text = enclosure.scad_text(BoxSpec(**small()), "base")
    assert "YAPPgenerator_v3.scad" in text
    assert "S1" in text or "front" in text.lower() or "yappFront" in text


def test_health_reports_whether_openscad_is_there():
    j = client.get("/enclosure/health").json()
    assert j["ok"] is HAVE_OPENSCAD
    assert (j["openscad"] is not None) is HAVE_OPENSCAD


def test_the_route_answers_503_when_openscad_is_missing(monkeypatch):
    import main

    monkeypatch.setattr(main._shutil, "which", lambda _name: None)
    r = client.post("/enclosure/yapp", json=small())
    assert r.status_code == 503
    assert "OpenSCAD" in r.json()["detail"]


def test_the_route_answers_504_when_openscad_runs_out_of_time(monkeypatch):
    import main

    monkeypatch.setattr(main._shutil, "which", lambda _name: "/usr/bin/openscad")

    def slow(*_a, **_k):
        raise EnclosureError("OpenSCAD did not finish within 10 seconds.")

    monkeypatch.setattr(main, "_generate_yapp", slow)
    r = client.post("/enclosure/yapp", json=small())
    assert r.status_code == 504
    assert "10 seconds" in r.json()["detail"]


def test_a_spec_with_a_thin_wall_is_refused_with_422():
    r = client.post("/enclosure/yapp", json=small(wall=0.2))
    assert r.status_code == 422


@needs_openscad
def test_openscad_builds_a_watertight_base_and_lid_with_the_opening_in_the_front_wall():
    out = generate(BoxSpec(**small()), timeout=150)
    assert out["planner_check"]["base"]["closed"] and out["planner_check"]["lid"]["closed"]

    def tris(key):
        raw = base64.b64decode(out[key])
        n = struct.unpack("<I", raw[80:84])[0]
        return [struct.unpack("<12fH", raw[84 + 50 * i : 134 + 50 * i])[3:12] for i in range(n)]

    base = tris("base_stl")
    pts = [(t[i], t[i + 1], t[i + 2]) for t in base for i in (0, 3, 6)]
    xs, ys, zs = zip(*pts)
    assert min(xs) == pytest.approx(0, abs=0.01) and max(xs) == pytest.approx(40, abs=0.01)
    assert min(ys) == pytest.approx(0, abs=0.01) and max(ys) == pytest.approx(30, abs=0.01)
    ring = lambda y: [p for p in pts if abs(p[1] - y) < 0.01 and abs(math.hypot(p[0] - 20, p[2] - 10) - 4) < 0.1]
    assert ring(0), "the round opening is not in the front wall (low Y)"
    assert not ring(30), "an opening appeared in the back wall"
