import shutil

import pytest
import yaml
from fastapi.testclient import TestClient
from pydantic import ValidationError

from harness import HarnessError, HarnessRequest, build_yaml, render
from main import app

client = TestClient(app)

HAVE_WIREVIZ = shutil.which("wireviz") is not None and shutil.which("dot") is not None
needs_wireviz = pytest.mark.skipif(not HAVE_WIREVIZ, reason="wireviz and graphviz (dot) are not installed here")


def wire(i, a, ap, b, bp, **kw):
    return {"id": str(i), "from": a, "fromPin": ap, "to": b, "toPin": bp, **kw}


BASE = {
    "title": "Example",
    "connectors": [
        {"ref": "U1", "title": "Controller", "pins": ["VCC", "GND", "SIG"]},
        {"ref": "J1", "title": "Battery"},
        {"ref": "SW1", "title": "Switch"},
    ],
    "wires": [
        wire(1, "J1", "+", "SW1", "1", colour="red", lengthMm=120, net="VBAT"),
        wire(2, "SW1", "2", "U1", "VCC", colour="red", lengthMm=80.25),
        wire(3, "J1", "-", "U1", "GND", colour="black", lengthMm=95, via="R1", gauge="0.25 mm2"),
    ],
}


def test_yaml_has_connectors_cables_and_connections():
    doc = yaml.safe_load(build_yaml(HarnessRequest(**BASE)))
    assert doc["metadata"] == {"title": "Example"}
    assert set(doc["connectors"]) == {"U1", "J1", "SW1"}
    assert doc["connectors"]["U1"]["pinlabels"] == ["VCC", "GND", "SIG"]
    assert doc["connectors"]["U1"]["pincount"] == 3
    # pins a wire names are added in order of first use
    assert doc["connectors"]["J1"]["pinlabels"] == ["+", "-"]
    assert doc["cables"]["W1"] == {"wirecount": 1, "colors": ["RD"], "length": "120.0 mm", "notes": "net VBAT"}
    assert doc["cables"]["W2"]["length"] == "80.2 mm" or doc["cables"]["W2"]["length"] == "80.3 mm"
    assert doc["cables"]["W3"]["gauge"] == "0.25 mm2"
    assert doc["cables"]["W3"]["colors"] == ["BK"]
    assert doc["cables"]["W3"]["notes"] == "via R1"
    assert doc["connections"][0] == [{"J1": [1]}, {"W1": [1]}, {"SW1": [1]}]
    assert doc["connections"][2] == [{"J1": [2]}, {"W3": [1]}, {"U1": [2]}]


def test_every_wire_in_the_request_is_one_cable_in_order():
    doc = yaml.safe_load(build_yaml(HarnessRequest(**BASE)))
    assert list(doc["cables"]) == ["W1", "W2", "W3"]
    assert len(doc["connections"]) == 3


def test_unknown_colour_is_left_out_not_guessed():
    req = HarnessRequest(**{**BASE, "wires": [wire(1, "J1", "+", "U1", "VCC", colour="any pair")]})
    assert "colors" not in yaml.safe_load(build_yaml(req))["cables"]["W1"]


def test_a_connector_no_wire_touches_is_left_out():
    req = HarnessRequest(**{**BASE, "wires": [wire(1, "J1", "+", "U1", "VCC")]})
    assert set(yaml.safe_load(build_yaml(req))["connectors"]) == {"J1", "U1"}


def test_an_empty_pin_name_gets_a_visible_label():
    req = HarnessRequest(**{**BASE, "wires": [wire(1, "J1", "", "U1", "VCC")]})
    assert yaml.safe_load(build_yaml(req))["connectors"]["J1"]["pinlabels"] == ["?"]


def test_text_cannot_become_yaml_syntax():
    nasty = "x: [1, 2]\n- !!python/object/apply:os.system ['id']"
    req = HarnessRequest(**{**BASE, "connectors": [{"ref": "U1", "title": nasty}, {"ref": "J1", "title": "{a: b}"}], "wires": [wire(1, "J1", nasty, "U1", "VCC", net=nasty)]})
    text = build_yaml(req)
    doc = yaml.safe_load(text)  # safe_load would refuse a python tag
    assert doc["connectors"]["U1"]["type"] == nasty
    assert doc["cables"]["W1"]["notes"] == f"net {nasty}"


@pytest.mark.parametrize(
    "mutate,why",
    [
        (lambda b: b["wires"].append(wire(9, "J1", "+", "NOPE", "1")), "not in the connectors"),
        (lambda b: b["connectors"].append({"ref": "U1"}), "more than once"),
        (lambda b: b["wires"].append(wire(1, "J1", "+", "U1", "VCC")), "more than once"),
        (lambda b: b.update(wires=[]), "at least 1"),
    ],
)
def test_bad_requests_are_refused(mutate, why):
    import copy
    b = copy.deepcopy(BASE)
    mutate(b)
    with pytest.raises(ValidationError, match=why):
        HarnessRequest(**b)


def test_the_endpoint_refuses_a_bad_request_with_422():
    r = client.post("/harness", json={**BASE, "wires": [wire(1, "J1", "+", "NOPE", "1")]})
    assert r.status_code == 422


@needs_wireviz
def test_wireviz_really_draws_the_harness():
    out = render(HarnessRequest(**BASE))
    assert out["svg"].lstrip().startswith("<?xml") or "<svg" in out["svg"][:400]
    assert "</svg>" in out["svg"]
    # the labels we sent are in the drawing
    for word in ("U1", "J1", "SW1", "VCC"):
        assert word in out["svg"]
    assert out["seconds"] < 20
    assert out["wireviz"].startswith("WireViz")
    designators = {d for row in out["bom"] for d in row["Designators"].split(", ")}
    assert {"W1", "W2", "W3", "J1", "U1", "SW1"} <= designators
    # the cable lengths ride into the bill of materials
    assert any(row.get("Unit") == "mm" for row in out["bom"])


@needs_wireviz
def test_the_endpoint_returns_svg_bom_and_yaml():
    r = client.post("/harness", json=BASE)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "<svg" in j["svg"]
    assert j["bom"] and j["yaml"].startswith("metadata:")


@needs_wireviz
def test_a_time_limit_is_honoured(monkeypatch):
    with pytest.raises(HarnessError) as e:
        render(HarnessRequest(**BASE), seconds=0.001)
    assert e.value.status == 504
    assert "did not finish" in e.value.message


def test_missing_wireviz_is_reported_not_hidden(monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda name: None)
    with pytest.raises(HarnessError) as e:
        render(HarnessRequest(**BASE))
    assert e.value.status == 503
    assert "not installed" in e.value.message
    r = client.post("/harness", json=BASE)
    assert r.status_code == 503


def test_wireviz_is_never_imported():
    import pathlib
    for f in pathlib.Path(__file__).resolve().parent.parent.glob("*.py"):
        text = f.read_text()
        assert "import wireviz" not in text and "from wireviz" not in text, f.name
