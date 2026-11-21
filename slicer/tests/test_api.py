import io
import json

import pytest
from fastapi.testclient import TestClient

from app import main, orca


@pytest.fixture
def client(tmp_path, fake_orca, fake_tree, monkeypatch):
    root, table = fake_tree
    monkeypatch.setattr(main, "ROOT", root)
    monkeypatch.setattr(main, "TABLE", table)
    monkeypatch.setattr(main, "WORK", tmp_path / "jobs")
    monkeypatch.setattr(orca, "ORCA_BIN", str(fake_orca))
    return TestClient(main.app)


def post(client, name="cube.stl", **form):
    data = {"maker": "Bambu Lab", "model": "A1", "material": "PLA", "layer_height": "0.2", "infill": "15", "supports": "false", **form}
    return client.post("/slice", files={"file": (name, io.BytesIO(b"solid x\nendsolid x\n"), "application/octet-stream")}, data=data)


def test_slice_returns_what_the_slicer_wrote_not_an_estimate(client):
    r = post(client)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["result"]["seconds"] == 1191.2
    assert j["result"]["filamentG"] == 3.7 and j["result"]["filamentMm"] == 1221.41
    assert j["result"]["readFrom"] == "statistics.json"
    assert j["profile"]["filament"] == "Bambu PLA Basic @BBL A1"
    assert j["files"]["gcode"]["name"] == "cube.gcode"
    g = client.get(j["files"]["gcode"]["url"])
    assert g.status_code == 200 and b"HEADER_BLOCK_START" in g.content
    assert client.get(j["files"]["project"]["url"]).content == b"PK-fake"


def test_arguments_reach_the_slicer(client, tmp_path):
    j = post(client, supports="true", infill="40", layer_height="0.16", material="PETG").json()
    args = json.loads((tmp_path / "jobs" / j["id"] / "args.json").read_text())
    assert "--enable-support=1" in args and "40%" in args
    settings = args[args.index("--load-settings") + 1]
    assert "0.16mm Optimal @BBL A1.json" in settings
    assert args[args.index("--load-filaments") + 1].endswith("Bambu PETG Basic @BBL A1.json")


def test_prusa_reads_its_own_samples(client):
    j = post(client, maker="Prusa Research", model="MK4S").json()
    assert j["result"]["seconds"] == 863.6


def test_refuses_other_file_types(client):
    assert post(client, name="x.exe").status_code == 422


def test_refuses_a_model_with_no_profile(client):
    r = post(client, model="H3C")
    assert r.status_code == 422 and "no machine profile" in r.json()["detail"]


def test_slicer_failure_is_reported_with_its_own_words(client, monkeypatch, tmp_path):
    monkeypatch.setenv("FAKE_FAIL", "1")
    r = post(client)
    assert r.status_code == 422 and "too big for the plate" in r.json()["detail"]
    assert not list((tmp_path / "jobs").iterdir())  # the failed job's folder is removed


def test_missing_binary_says_so(client, monkeypatch):
    monkeypatch.setattr(orca, "ORCA_BIN", "/nonexistent/orca")
    r = post(client)
    assert r.status_code == 503 and "not installed" in r.json()["detail"]


def test_job_ids_are_validated(client):
    assert client.get("/jobs/../../etc/passwd/gcode").status_code == 404
    assert client.get("/jobs/" + "0" * 32 + "/gcode").status_code == 404
    assert client.get("/jobs/" + "0" * 32 + "/other").status_code == 404


def test_old_jobs_are_swept(client, tmp_path, monkeypatch):
    j = post(client).json()
    monkeypatch.setattr(main, "TTL_S", -1)
    post(client)
    assert client.get(j["files"]["gcode"]["url"]).status_code == 404


def test_profiles_and_health(client):
    p = client.get("/profiles").json()
    assert any(x["model"] == "H3C" and not x["available"] for x in p["printers"])
    assert client.get("/health").json()["ok"] is True
