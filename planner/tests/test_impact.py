"""The impact service: what is downstream of a change, grouped by section, with a path to each."""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def node(id, section):
    return {"id": id, "section": section}


# A small concept: one requirement served by a part and checked by a test; the part is joined by a wire,
# whose build-sheet line follows it; an assembly step uses the part; the economics line sums the parts.
NODES = [
    node("r1", "design/requirements"),
    node("t1", "prototype/tests"),
    node("p1", "design/bom"),
    node("p2", "design/bom"),
    node("w1", "design/wiring"),
    node("b1", "prototype/wiring"),
    node("s1", "prototype/assembly"),
    node("e1", "production/economics"),
    node("x", "concept/brief"),
]
EDGES = [("r1", "t1"), ("r1", "p1"), ("p1", "w1"), ("p2", "w1"), ("w1", "b1"), ("p1", "s1"), ("w1", "s1"), ("p1", "e1"), ("p2", "e1")]


def post(changed, nodes=NODES, edges=EDGES):
    r = client.post("/impact", json={"nodes": nodes, "edges": [list(e) for e in edges], "changed": changed})
    return r


def test_descendants_of_a_requirement_grouped_by_section():
    r = post(["r1"])
    assert r.status_code == 200, r.text
    j = r.json()
    ids = {a["id"] for a in j["affected"]}
    assert ids == {"t1", "p1", "w1", "b1", "s1", "e1"}
    assert j["total"] == 6
    assert set(j["by_section"]) == {"prototype/tests", "design/bom", "design/wiring", "prototype/wiring", "prototype/assembly", "production/economics"}
    assert "x" not in ids and "p2" not in ids and "r1" not in ids


def test_each_row_has_the_shortest_path_from_the_change():
    j = post(["r1"]).json()
    path = {a["id"]: a["path"] for a in j["affected"]}
    assert path["t1"] == ["r1", "t1"]
    assert path["b1"] == ["r1", "p1", "w1", "b1"]
    # s1 is reached directly from p1, which is shorter than through the wire
    assert path["s1"] == ["r1", "p1", "s1"]
    # nearest first
    assert [len(a["path"]) for a in j["affected"]] == sorted(len(a["path"]) for a in j["affected"])


def test_a_leaf_affects_nothing():
    j = post(["t1"]).json()
    assert j["affected"] == [] and j["total"] == 0 and j["by_section"] == {}


def test_several_changes_take_the_nearest_source():
    j = post(["p2", "r1"]).json()
    path = {a["id"]: a["path"] for a in j["affected"]}
    assert path["w1"] == ["p2", "w1"]
    assert path["e1"] == ["p2", "e1"]
    assert "p2" not in path and "r1" not in path


def test_loops_do_not_hang_and_do_not_list_the_change_itself():
    nodes = [node("a", "s"), node("b", "s"), node("c", "s")]
    j = post(["a"], nodes, [("a", "b"), ("b", "c"), ("c", "a")]).json()
    assert {a["id"] for a in j["affected"]} == {"b", "c"}


def test_unknown_ids_are_refused():
    assert post(["nope"]).status_code == 422
    assert post(["r1"], NODES, EDGES + [("r1", "ghost")]).status_code == 422
    r = client.post("/impact", json={"nodes": NODES, "edges": [], "changed": []})
    assert r.status_code == 422


def test_ten_thousand_rows_answer_quickly():
    import time

    nodes = [node(f"n{i}", f"s{i % 7}") for i in range(10_000)]
    edges = [(f"n{i}", f"n{i + 1}") for i in range(9_999)] + [(f"n{i}", f"n{(i * 7) % 10_000}") for i in range(0, 10_000, 3)]
    t = time.perf_counter()
    r = post(["n0"], nodes, edges)
    assert r.status_code == 200
    assert r.json()["total"] == 9_999
    assert time.perf_counter() - t < 5
