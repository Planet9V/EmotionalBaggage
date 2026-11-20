"""The planner service: order, waves, timing over remaining work, and the cycle rule."""
import random
import time

import networkx as nx
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def post(nodes, edges=()):
    r = client.post("/plan", json={"nodes": nodes, "edges": [list(e) for e in edges]})
    assert r.status_code == 200, r.text
    return r.json()


def n(id, minutes=0, remaining=None):
    d = {"id": id, "minutes": minutes}
    if remaining is not None:
        d["remaining"] = remaining
    return d


# The seeded assembly: p0 bench, p1 print, p2 electronics, p3 power-on, p4 firmware,
# p5 audio, p6 integration, p7 tests, p8 pack-out.
ASSEMBLY = [n("p0", 15), n("p1", 345), n("p2", 90), n("p3", 10), n("p4", 20), n("p5", 15), n("p6", 30), n("p7", 30), n("p8", 10)]
ASSEMBLY_EDGES = [("p0", "p1"), ("p0", "p2"), ("p2", "p3"), ("p3", "p4"), ("p0", "p5"), ("p1", "p6"), ("p4", "p6"), ("p5", "p6"), ("p6", "p7"), ("p7", "p8")]


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "networkx": nx.__version__}


def test_order_and_waves():
    p = post(ASSEMBLY, ASSEMBLY_EDGES)
    assert p["order"] == ["p0", "p1", "p2", "p5", "p3", "p4", "p6", "p7", "p8"]
    assert p["wave"] == {"p0": 0, "p1": 1, "p2": 1, "p5": 1, "p3": 2, "p4": 3, "p6": 4, "p7": 5, "p8": 6}
    pos = {k: i for i, k in enumerate(p["order"])}
    assert all(pos[a] < pos[b] for a, b in ASSEMBLY_EDGES)
    assert p["cycles"] == [] and p["blocked"] == []


def test_earliest_start_and_finish():
    p = post(ASSEMBLY, ASSEMBLY_EDGES)
    assert p["start"]["p0"] == 0 and p["finish"]["p0"] == 15
    assert (p["start"]["p4"], p["finish"]["p4"]) == (115, 135)
    # integration waits for the longest of print (360), firmware (135) and audio (30)
    assert (p["start"]["p6"], p["finish"]["p6"]) == (360, 390)
    assert p["finish"]["p8"] == 430


def test_critical_path_all_open():
    p = post(ASSEMBLY, ASSEMBLY_EDGES)
    assert p["critical_path"] == ["p0", "p1", "p6", "p7", "p8"]
    assert p["total_minutes"] == 430
    assert p["planned_minutes"] == 430


def test_critical_path_over_remaining_work():
    # bench and print finished: the electronics branch becomes critical
    nodes = [dict(x) for x in ASSEMBLY]
    for x in nodes:
        if x["id"] in ("p0", "p1"):
            x["remaining"] = 0
    p = post(nodes, ASSEMBLY_EDGES)
    assert p["critical_path"] == ["p0", "p2", "p3", "p4", "p6", "p7", "p8"]
    assert p["total_minutes"] == 190  # 90 + 10 + 20 + 30 + 30 + 10
    assert p["planned_minutes"] == 205  # the same chain in full minutes, with the 15-minute bench
    assert p["finish"]["p1"] == 0


def test_everything_done_keeps_the_longest_planned_chain():
    nodes = [dict(x, remaining=0) for x in ASSEMBLY]
    p = post(nodes, ASSEMBLY_EDGES)
    assert p["total_minutes"] == 0
    assert p["critical_path"] == ["p0", "p1", "p6", "p7", "p8"]
    assert p["planned_minutes"] == 430


def test_zero_minute_milestone_gates_its_successors():
    p = post([n("go"), n("a", 10), n("b", 5)], [("go", "a"), ("go", "b")])
    assert p["order"][0] == "go" and p["wave"]["a"] == 1
    assert p["critical_path"] == ["go", "a"] and p["total_minutes"] == 10


def test_simple_cycle():
    p = post([n("a", 1), n("b", 2), n("c", 3)], [("a", "b"), ("b", "a")])
    assert p["cycles"] == [["a", "b"]]
    assert p["blocked"] == ["a", "b"]
    assert p["order"] == ["c"]
    assert "a" not in p["wave"] and "a" not in p["start"] and "a" not in p["finish"]
    assert p["critical_path"] == ["c"] and p["total_minutes"] == 3


def test_self_loop_is_a_cycle():
    p = post([n("a", 1), n("b", 1)], [("a", "a"), ("a", "b")])
    assert p["cycles"] == [["a"]]
    assert p["blocked"] == ["a", "b"]
    assert p["order"] == []


def test_cycle_with_downstream_nodes_blocks_all_of_them():
    nodes = [n(x, 5) for x in ("root", "a", "b", "c", "d", "e", "free")]
    edges = [("root", "a"), ("a", "b"), ("b", "c"), ("c", "a"), ("c", "d"), ("d", "e"), ("root", "free")]
    p = post(nodes, edges)
    assert p["cycles"] == [["a", "b", "c"]]
    assert p["blocked"] == ["a", "b", "c", "d", "e"]
    assert p["order"] == ["root", "free"]
    assert set(p["wave"]) == {"root", "free"}
    assert p["critical_path"] == ["root", "free"]
    assert p["total_minutes"] == 10


def test_two_separate_cycles():
    nodes = [n(x, 1) for x in ("a", "b", "c", "d", "e", "x")]
    edges = [("a", "b"), ("b", "a"), ("c", "d"), ("d", "e"), ("e", "c")]
    p = post(nodes, edges)
    assert p["cycles"] == [["a", "b"], ["c", "d", "e"]]
    assert p["order"] == ["x"]


def test_empty_graph():
    p = post([], [])
    assert p == {
        "order": [], "wave": {}, "start": {}, "finish": {}, "critical_path": [],
        "total_minutes": 0, "planned_minutes": 0, "cycles": [], "blocked": [],
    }
    assert client.post("/plan", json={}).status_code == 200


def test_unknown_id_in_an_edge_is_rejected():
    r = client.post("/plan", json={"nodes": [n("a")], "edges": [["a", "ghost"]]})
    assert r.status_code == 422
    assert "ghost" in r.text


def test_duplicate_node_id_is_rejected():
    r = client.post("/plan", json={"nodes": [n("a"), n("a")], "edges": []})
    assert r.status_code == 422


@pytest.mark.parametrize("bad", [{"id": "a", "minutes": -1}, {"id": "a", "minutes": 1, "remaining": -0.5}])
def test_negative_minutes_are_rejected(bad):
    assert client.post("/plan", json={"nodes": [bad]}).status_code == 422


def timed(nodes, edges):
    t = time.perf_counter()
    p = post(nodes, edges)
    return p, time.perf_counter() - t


def test_long_chain_is_fast():
    k = 2000
    nodes = [n(f"s{i}", 1) for i in range(k)]
    edges = [(f"s{i}", f"s{i + 1}") for i in range(k - 1)]
    p, dt = timed(nodes, edges)
    assert len(p["critical_path"]) == k and p["total_minutes"] == k
    assert dt < 0.5, f"2,000-node chain took {dt:.3f} s"


def test_long_chain_closed_into_a_loop_is_fast():
    k = 2000
    nodes = [n(f"s{i}", 1) for i in range(k)]
    edges = [(f"s{i}", f"s{(i + 1) % k}") for i in range(k)]
    p, dt = timed(nodes, edges)
    assert len(p["cycles"]) == 1 and len(p["cycles"][0]) == k
    assert dt < 0.5, f"2,000-node loop took {dt:.3f} s"


def test_dense_graph_with_many_cycles_is_fast():
    # 300 nodes, every ordered pair joined with probability 0.3 (about 27,000 edges).
    # The number of simple cycles here is astronomically large; the old
    # nx.simple_cycles would never finish.
    rng = random.Random(7)
    ids = [f"v{i}" for i in range(300)]
    edges = [(a, b) for a in ids for b in ids if a != b and rng.random() < 0.3]
    p, dt = timed([n(i, 1) for i in ids], edges)
    assert len(p["cycles"]) == 1 and len(p["cycles"][0]) == 300
    assert p["order"] == []
    assert dt < 1.0, f"dense 300-node graph took {dt:.3f} s"


def test_dense_dag_is_fast():
    rng = random.Random(11)
    ids = [f"v{i:03d}" for i in range(300)]
    edges = [(ids[i], ids[j]) for i in range(300) for j in range(i + 1, 300) if rng.random() < 0.3]
    p, dt = timed([n(i, 1) for i in ids], edges)
    assert p["cycles"] == [] and len(p["order"]) == 300
    assert p["total_minutes"] == len(p["critical_path"])
    assert dt < 1.0, f"dense 300-node DAG took {dt:.3f} s"
