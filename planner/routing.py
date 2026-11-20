"""Wire routing through an enclosure, with NetworkX.

The free space inside the enclosure is cut into a grid of cells. Cells inside a
part's body (grown by a clearance) are removed. A wire is the cheapest path
between its two ends through what is left; a net with more than two ends is one
tree joining them all (a Steiner tree), and the points where it branches are
reported as splices.

Nothing is guessed: an end with no free cell near it, or two ends with no free
path between them, is reported by name.

Units are millimetres. Any right-handed axes work; the service only needs boxes.
"""
from __future__ import annotations

import math
from itertools import product

import networkx as nx
from networkx.algorithms.approximation import steiner_tree
from pydantic import BaseModel, Field, model_validator

Vec = tuple[float, float, float]
Cell = tuple[int, int, int]


class Box(BaseModel):
    min: Vec
    max: Vec

    @model_validator(mode="after")
    def ordered(self):
        if any(a >= b for a, b in zip(self.min, self.max)):
            raise ValueError("a box needs min below max on every axis")
        return self


class Obstacle(Box):
    id: str = Field(min_length=1)


class Terminal(BaseModel):
    id: str = Field(min_length=1)
    pos: Vec


class Net(BaseModel):
    id: str = Field(min_length=1)
    terminals: list[Terminal] = Field(min_length=2)


class RouteRequest(BaseModel):
    space: Box
    obstacles: list[Obstacle] = []
    nets: list[Net] = []
    # edge length of a grid cell; grown automatically if the grid would be too large
    cell: float = Field(default=2.0, gt=0)
    max_cells: int = Field(default=150_000, ge=1_000, le=2_000_000)
    # free space kept around every obstacle
    clearance: float = Field(default=1.0, ge=0)
    # extra wire at each end for stripping and a service loop
    allowance: float = Field(default=10.0, ge=0)
    # cut lengths are rounded up to a multiple of this
    round_to: float = Field(default=5.0, gt=0)
    # a cell already used by an earlier wire costs this fraction, so wires bundle
    bundle: float = Field(default=0.7, gt=0, le=1)
    # how far (in cells) to look for free space around an end that sits inside a part
    snap_cells: int = Field(default=6, ge=0, le=50)

    @model_validator(mode="after")
    def unique_ids(self):
        seen: set[str] = set()
        for n in self.nets:
            if n.id in seen:
                raise ValueError(f"net id {n.id!r} appears more than once")
            seen.add(n.id)
        return self


class Grid:
    """The free cells of the space as a NetworkX graph, with the mapping to millimetres."""

    def __init__(self, req: RouteRequest):
        self.origin = req.space.min
        size = [b - a for a, b in zip(req.space.min, req.space.max)]
        cell = req.cell

        def dims(c: float) -> list[int]:
            return [max(1, math.ceil(s / c)) for s in size]

        while math.prod(dims(cell)) > req.max_cells:
            cell *= 1.25
        self.cell = cell
        self.dims = dims(cell)
        self.bundle = req.bundle

        blocked: set[Cell] = set()
        for o in req.obstacles:
            lo = [math.floor((o.min[i] - req.clearance - self.origin[i]) / cell) for i in range(3)]
            hi = [math.ceil((o.max[i] + req.clearance - self.origin[i]) / cell) - 1 for i in range(3)]
            ranges = [range(max(0, lo[i]), min(self.dims[i] - 1, hi[i]) + 1) for i in range(3)]
            for c in product(*ranges):
                # a cell is blocked when its centre is inside the grown obstacle
                p = self.centre(c)
                if all(o.min[i] - req.clearance <= p[i] <= o.max[i] + req.clearance for i in range(3)):
                    blocked.add(c)
        self.blocked = blocked

        G = nx.grid_graph(dim=[range(self.dims[2]), range(self.dims[1]), range(self.dims[0])])
        # grid_graph orders tuple axes as given reversed, so nodes are (x, y, z)
        G.remove_nodes_from(blocked)
        nx.set_edge_attributes(G, cell, "w")
        self.G = G

    def centre(self, c: Cell) -> Vec:
        return tuple(self.origin[i] + (c[i] + 0.5) * self.cell for i in range(3))  # type: ignore[return-value]

    def cell_of(self, p: Vec) -> Cell:
        return tuple(min(self.dims[i] - 1, max(0, math.floor((p[i] - self.origin[i]) / self.cell))) for i in range(3))  # type: ignore[return-value]

    def inside(self, p: Vec, slack: float = 1e-6) -> bool:
        return all(self.origin[i] - slack <= p[i] <= self.origin[i] + self.dims[i] * self.cell + slack for i in range(3))

    def nearest_free(self, p: Vec, reach: int) -> Cell | None:
        """The free cell whose centre is closest to p, looking at most `reach` cells out."""
        start = self.cell_of(p)
        if start in self.G:
            return start
        best: tuple[float, Cell] | None = None
        for r in range(1, reach + 1):
            for d in product(range(-r, r + 1), repeat=3):
                if max(abs(x) for x in d) != r:
                    continue
                c = (start[0] + d[0], start[1] + d[1], start[2] + d[2])
                if c in self.G:
                    dist = math.dist(self.centre(c), p)
                    if best is None or dist < best[0]:
                        best = (dist, c)
            if best is not None:
                return best[1]
        return None

    def clear_line(self, a: Vec, b: Vec) -> bool:
        """True when the straight line from a to b stays in free cells."""
        steps = max(1, math.ceil(math.dist(a, b) / (self.cell / 2)))
        for k in range(steps + 1):
            t = k / steps
            p = tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
            if self.cell_of(p) not in self.G:  # type: ignore[arg-type]
                return False
        return True

    def straighten(self, cells: list[Cell]) -> list[Vec]:
        """Cell path to a polyline: drop points on a straight run, then cut corners where the line is clear."""
        pts = [self.centre(c) for c in cells]
        if len(pts) <= 2:
            return pts
        out = [pts[0]]
        i = 0
        while i < len(pts) - 1:
            j = len(pts) - 1
            while j > i + 1 and not self.clear_line(pts[i], pts[j]):
                j -= 1
            out.append(pts[j])
            i = j
        return out

    def use(self, cells: list[Cell]) -> None:
        """Make the cells of a routed wire cheaper, so later wires prefer to run alongside."""
        for a, b in zip(cells, cells[1:]):
            self.G[a][b]["w"] = self.cell * self.bundle


def _length(points: list[Vec]) -> float:
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def _round_up(x: float, step: float) -> float:
    return math.ceil(round(x / step, 9)) * step


def _snap(grid: Grid, net: Net, reach: int) -> tuple[dict[str, Cell], list[dict]]:
    cells: dict[str, Cell] = {}
    problems: list[dict] = []
    for t in net.terminals:
        if not grid.inside(t.pos, slack=grid.cell):
            problems.append({"terminal": t.id, "reason": "outside the enclosure"})
            continue
        c = grid.nearest_free(t.pos, reach)
        if c is None:
            problems.append({"terminal": t.id, "reason": "buried: no free space within reach of this end"})
        else:
            cells[t.id] = c
    return cells, problems


def _two_ends(grid: Grid, req: RouteRequest, net: Net, cells: dict[str, Cell]) -> dict:
    a, b = net.terminals
    ca, cb = cells[a.id], cells[b.id]

    def h(u: Cell, v: Cell) -> float:
        # the cheapest any step can be is a bundled cell, so this never overestimates
        return (abs(u[0] - v[0]) + abs(u[1] - v[1]) + abs(u[2] - v[2])) * grid.cell * grid.bundle

    try:
        path = nx.astar_path(grid.G, ca, cb, heuristic=h, weight="w")
    except nx.NetworkXNoPath:
        return {"id": net.id, "ok": False, "problems": [{"terminal": b.id, "reason": f"no free path from {a.id}"}]}
    grid.use(path)
    points = [a.pos, *grid.straighten(path), b.pos]
    run = _length(points)
    return {
        "id": net.id,
        "ok": True,
        "kind": "wire",
        "branches": [{"from": a.id, "to": b.id, "points": points, "length": round(run, 2),
                      "cut_length": _round_up(run + 2 * req.allowance, req.round_to)}],
        "splices": [],
        "length": round(run, 2),
        "cut_length": _round_up(run + 2 * req.allowance, req.round_to),
    }


def _many_ends(grid: Grid, req: RouteRequest, net: Net, cells: dict[str, Cell]) -> dict:
    by_cell: dict[Cell, list[Terminal]] = {}
    for t in net.terminals:
        by_cell.setdefault(cells[t.id], []).append(t)
    terminals = list(by_cell)
    comp = nx.node_connected_component(grid.G, terminals[0])
    cut_off = [t.id for c in terminals if c not in comp for t in by_cell[c]]
    if cut_off:
        first = by_cell[terminals[0]][0].id
        return {"id": net.id, "ok": False,
                "problems": [{"terminal": t, "reason": f"no free path from {first}"} for t in cut_off]}

    tree = steiner_tree(grid.G, terminals, weight="w", method="mehlhorn") if len(terminals) > 1 else nx.Graph()
    if len(terminals) == 1:
        tree.add_node(terminals[0])

    # Key points of the tree: the ends, and every cell where three or more runs meet (a splice).
    key = {c for c in tree if c in by_cell or tree.degree(c) >= 3}
    splices = sorted(c for c in key if c not in by_cell)
    name: dict[Cell, str] = {c: by_cell[c][0].id for c in by_cell}
    name.update({c: f"splice-{i + 1}" for i, c in enumerate(splices)})

    branches: list[dict] = []
    seen: set[frozenset] = set()
    for start in sorted(key):
        for nxt in tree.neighbors(start):
            path = [start, nxt]
            while path[-1] not in key:
                step = [n for n in tree.neighbors(path[-1]) if n != path[-2]]
                path.append(step[0])
            edge = frozenset((start, path[-1], path[1], path[-2]))
            if edge in seen:
                continue
            seen.add(edge)
            grid.use(path)
            points = grid.straighten(path)
            if path[0] in by_cell:
                points = [by_cell[path[0]][0].pos, *points]
            if path[-1] in by_cell:
                points = [*points, by_cell[path[-1]][0].pos]
            run = _length(points)
            # every branch is stripped at both ends, whether an end is a pin or a splice
            branches.append({"from": name[path[0]], "to": name[path[-1]], "points": points, "length": round(run, 2),
                             "cut_length": _round_up(run + 2 * req.allowance, req.round_to)})
    # Ends that share a cell with another end of the same net join at that point.
    for c, ts in by_cell.items():
        for extra in ts[1:]:
            run = math.dist(ts[0].pos, extra.pos)
            branches.append({"from": ts[0].id, "to": extra.id, "points": [ts[0].pos, extra.pos], "length": round(run, 2),
                             "cut_length": _round_up(run + 2 * req.allowance, req.round_to)})
    total = sum(b["length"] for b in branches)
    return {
        "id": net.id,
        "ok": True,
        "kind": "tree",
        "branches": branches,
        "splices": [{"id": name[c], "pos": grid.centre(c)} for c in splices],
        "length": round(total, 2),
        "cut_length": round(sum(b["cut_length"] for b in branches), 2),
    }


def route(req: RouteRequest) -> dict:
    grid = Grid(req)
    results: list[dict] = []
    for net in req.nets:
        cells, problems = _snap(grid, net, req.snap_cells)
        if problems:
            results.append({"id": net.id, "ok": False, "problems": problems})
        elif len(net.terminals) == 2:
            results.append(_two_ends(grid, req, net, cells))
        else:
            results.append(_many_ends(grid, req, net, cells))
    return {
        "cell": round(grid.cell, 4),
        "requested_cell": req.cell,
        "grid": {"dims": grid.dims, "cells": math.prod(grid.dims), "free": grid.G.number_of_nodes()},
        "nets": results,
        "routed": sum(1 for r in results if r["ok"]),
        "failed": sum(1 for r in results if not r["ok"]),
    }
