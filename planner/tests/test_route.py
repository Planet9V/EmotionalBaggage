import math
import time

import pytest
from fastapi.testclient import TestClient

from main import app
from routing import RouteRequest, route

client = TestClient(app)

SPACE = {"min": [0, 0, 0], "max": [80, 40, 60]}


def req(**kw):
    base = {"space": SPACE, "cell": 2, "clearance": 0, "allowance": 10, "round_to": 5}
    base.update(kw)
    return RouteRequest(**base)


def net(i, *ends):
    return {"id": i, "terminals": [{"id": f"{i}.{k}", "pos": list(p)} for k, p in enumerate(ends)]}


def polyline_length(points):
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def test_a_wire_in_empty_space_is_a_straight_line():
    out = route(req(nets=[net("n1", (5, 5, 5), (65, 5, 5))]))
    w = out["nets"][0]
    assert w["ok"] and w["kind"] == "wire"
    assert w["length"] == pytest.approx(60, abs=0.01)
    # 60 mm of run + 10 mm at each end = 80, already a multiple of 5
    assert w["cut_length"] == 80
    assert out["routed"] == 1 and out["failed"] == 0


def test_cut_length_rounds_up():
    out = route(req(nets=[net("n1", (5, 5, 5), (27, 5, 5))]))
    w = out["nets"][0]
    assert w["length"] == pytest.approx(22, abs=0.01)
    assert w["cut_length"] == 45  # 22 + 20 = 42, up to the next 5


def test_a_wire_goes_round_a_part_and_never_through_it():
    wall = {"id": "wall", "min": [38, 0, 0], "max": [42, 30, 60]}  # leaves a gap above y = 30
    out = route(req(obstacles=[wall], nets=[net("n1", (10, 5, 30), (70, 5, 30))]))
    w = out["nets"][0]
    assert w["ok"]
    assert w["length"] > 60 + 20  # must climb over the wall
    pts = w["branches"][0]["points"]
    for a, b in zip(pts, pts[1:]):
        for k in range(21):
            p = [a[i] + (b[i] - a[i]) * k / 20 for i in range(3)]
            inside = all(wall["min"][i] < p[i] < wall["max"][i] for i in range(3))
            assert not inside, f"the wire passes through the wall at {p}"


def test_clearance_keeps_the_wire_away_from_a_part():
    block = {"id": "b", "min": [38, 0, 0], "max": [42, 30, 60]}
    near = route(req(obstacles=[block], clearance=0, nets=[net("n", (10, 5, 30), (70, 5, 30))]))["nets"][0]
    far = route(req(obstacles=[block], clearance=4, nets=[net("n", (10, 5, 30), (70, 5, 30))]))["nets"][0]
    assert far["length"] > near["length"]


def test_an_end_inside_a_part_is_joined_from_the_nearest_free_space():
    part = {"id": "u1", "min": [0, 0, 0], "max": [10, 10, 10]}
    out = route(req(obstacles=[part], nets=[net("n1", (5, 5, 9), (60, 5, 30))]))
    w = out["nets"][0]
    assert w["ok"]
    assert w["branches"][0]["points"][0] == (5, 5, 9)  # the wire still ends at the pin itself


def test_a_buried_end_is_reported_by_name_not_guessed():
    part = {"id": "big", "min": [0, 0, 0], "max": [60, 40, 60]}
    out = route(req(obstacles=[part], snap_cells=3, nets=[net("n1", (30, 20, 30), (70, 20, 30))]))
    w = out["nets"][0]
    assert not w["ok"]
    assert w["problems"] == [{"terminal": "n1.0", "reason": "buried: no free space within reach of this end"}]
    assert out["failed"] == 1


def test_an_end_outside_the_enclosure_is_reported():
    out = route(req(nets=[net("n1", (5, 5, 5), (500, 5, 5))]))
    assert out["nets"][0]["problems"] == [{"terminal": "n1.1", "reason": "outside the enclosure"}]


def test_two_ends_with_no_path_between_them_are_reported():
    wall = {"id": "wall", "min": [38, 0, 0], "max": [42, 40, 60]}  # full height and depth: no way round
    out = route(req(obstacles=[wall], nets=[net("n1", (10, 5, 30), (70, 5, 30))]))
    w = out["nets"][0]
    assert not w["ok"] and w["problems"][0]["reason"] == "no free path from n1.0"


def test_a_net_with_three_ends_is_one_tree_shorter_than_separate_wires():
    ends = [(10, 5, 30), (70, 5, 30), (40, 35, 30)]
    out = route(req(nets=[net("gnd", *ends)]))
    t = out["nets"][0]
    assert t["ok"] and t["kind"] == "tree"
    star = math.dist(ends[0], ends[1]) + math.dist(ends[0], ends[2])
    assert t["length"] < star
    # every end appears, and the branches form one connected tree
    names = {b["from"] for b in t["branches"]} | {b["to"] for b in t["branches"]}
    assert {"gnd.0", "gnd.1", "gnd.2"} <= names
    assert len(t["branches"]) == len(names) - 1
    assert t["length"] == pytest.approx(sum(polyline_length(b["points"]) for b in t["branches"]), abs=0.05)


def test_a_tree_reports_where_it_branches():
    out = route(req(nets=[net("gnd", (10, 5, 30), (70, 5, 30), (40, 35, 30))]))
    t = out["nets"][0]
    assert len(t["splices"]) == 1
    assert t["splices"][0]["id"] == "splice-1"
    assert sum(1 for b in t["branches"] if "splice-1" in (b["from"], b["to"])) == 3


def test_later_wires_bundle_with_earlier_ones():
    # A second wire between nearby ends should follow the first rather than take its own way.
    first = net("a", (6, 6, 6), (70, 30, 50))
    second = net("b", (6, 10, 6), (70, 34, 50))
    together = route(req(bundle=0.5, nets=[first, second]))
    alone = route(req(bundle=1.0, nets=[second]))
    assert together["nets"][1]["ok"] and alone["nets"][0]["ok"]
    # bundling never makes a wire shorter than its own best path
    assert together["nets"][1]["length"] >= alone["nets"][0]["length"] - 0.01


def test_the_cell_grows_when_the_grid_would_be_too_large():
    out = route(req(space={"min": [0, 0, 0], "max": [400, 300, 200]}, cell=1, max_cells=20_000,
                    nets=[net("n1", (10, 10, 10), (390, 290, 190))]))
    assert out["requested_cell"] == 1
    assert out["cell"] > 1
    assert out["grid"]["cells"] <= 20_000
    assert out["nets"][0]["ok"]


def test_requests_are_validated():
    assert client.post("/route", json={"space": {"min": [0, 0, 0], "max": [0, 10, 10]}}).status_code == 422
    assert client.post("/route", json={"space": SPACE, "nets": [{"id": "n", "terminals": [{"id": "a", "pos": [1, 1, 1]}]}]}).status_code == 422
    dup = [net("n", (1, 1, 1), (9, 9, 9)), net("n", (1, 1, 1), (9, 9, 9))]
    assert client.post("/route", json={"space": SPACE, "nets": dup}).status_code == 422
    assert client.post("/route", json={"space": SPACE, "cell": 0}).status_code == 422


def test_the_endpoint_answers():
    r = client.post("/route", json={"space": SPACE, "nets": [net("n1", (5, 5, 5), (65, 5, 5))]})
    assert r.status_code == 200
    assert r.json()["nets"][0]["ok"] is True


def test_an_empty_request_is_an_empty_answer():
    out = client.post("/route", json={"space": SPACE}).json()
    assert out["nets"] == [] and out["routed"] == 0


def test_a_gadget_sized_job_is_quick():
    # Nine parts and eighteen wires in an 80 x 42 x 60 mm box at 2 mm cells: the size of the example product.
    obstacles = [{"id": f"p{i}", "min": [8 + 22 * (i % 3), 2, 6 + 18 * (i // 3)], "max": [22 + 22 * (i % 3), 12, 18 + 18 * (i // 3)]} for i in range(9)]
    centres = [((o["min"][0] + o["max"][0]) / 2, 12, (o["min"][2] + o["max"][2]) / 2) for o in obstacles]
    nets = [net(f"w{i}", centres[i % 9], centres[(i * 4 + 1) % 9]) for i in range(18) if i % 9 != (i * 4 + 1) % 9]
    t0 = time.perf_counter()
    out = route(RouteRequest(space={"min": [0, 0, 0], "max": [80, 42, 60]}, obstacles=obstacles, nets=nets))
    took = time.perf_counter() - t0
    assert out["failed"] == 0
    assert out["grid"]["cells"] == 40 * 21 * 30
    assert took < 5, f"took {took:.2f}s"
