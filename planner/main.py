"""Order-of-operations planner: the only implementation of the plan.

The web app builds the concept's graph (steps and decisions, see `planGraph`
in src/lib/plan.ts) and posts it here. NetworkX returns the build order, the
parallel waves, earliest start and finish per node over the work that is
left, the critical path, and the loops.

The single cycle rule: every node in a strongly connected component that
contains a cycle, and every node downstream of one, is blocked. Blocked nodes
get no wave, no start and no finish, and are left out of the order and the
critical path. Cycles are found with strongly connected components, which is
linear in the size of the graph.
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator
import networkx as nx

from impact import ImpactRequest, impact as impact_of
from fastapi import HTTPException
from harness import HarnessError, HarnessRequest, render as render_harness
from routing import RouteRequest, route as route_wires

app = FastAPI(title="Concept-to-realization planner")


class Node(BaseModel):
    id: str = Field(min_length=1)
    # full duration of the node, in minutes
    minutes: float = Field(default=0, ge=0)
    # minutes still to do; defaults to `minutes` (0 when the node is finished)
    remaining: float | None = Field(default=None, ge=0)


class Graph(BaseModel):
    nodes: list[Node] = []
    edges: list[tuple[str, str]] = []

    @model_validator(mode="after")
    def known_ids(self):
        ids: set[str] = set()
        for n in self.nodes:
            if n.id in ids:
                raise ValueError(f"node id {n.id!r} appears more than once")
            ids.add(n.id)
        for a, b in self.edges:
            for x in (a, b):
                if x not in ids:
                    raise ValueError(f"edge ({a!r}, {b!r}) names unknown node {x!r}")
        return self


@app.get("/health")
def health():
    return {"ok": True, "networkx": nx.__version__}


def _blocked(G: nx.DiGraph) -> tuple[list[list[str]], set[str]]:
    """Cyclic components, and every node in one or downstream of one."""
    cycles = []
    for comp in nx.strongly_connected_components(G):
        if len(comp) > 1 or any(G.has_edge(n, n) for n in comp):
            cycles.append(sorted(comp))
    cycles.sort()
    blocked: set[str] = set()
    stack = [n for c in cycles for n in c]
    while stack:
        n = stack.pop()
        if n in blocked:
            continue
        blocked.add(n)
        stack.extend(s for s in G.successors(n) if s not in blocked)
    return cycles, blocked


@app.post("/plan")
def plan(g: Graph):
    G = nx.DiGraph()
    for n in g.nodes:
        rem = n.minutes if n.remaining is None else n.remaining
        G.add_node(n.id, minutes=float(n.minutes), remaining=float(rem))
    G.add_edges_from(g.edges)

    cycles, blocked = _blocked(G)
    H = G.subgraph(n for n in G if n not in blocked)

    wave: dict[str, int] = {}
    order: list[str] = []
    for i, gen in enumerate(nx.topological_generations(H)):
        for n in sorted(gen):
            wave[n] = i
            order.append(n)
    idx = {n: i for i, n in enumerate(order)}

    # Earliest start and finish over remaining minutes. Each node also keeps the
    # predecessor that sets its start; ties go to the chain with more planned
    # (full) minutes, then to the predecessor earlier in the order, so the
    # critical path is deterministic and still meaningful when work is done.
    start: dict[str, float] = {}
    finish: dict[str, float] = {}
    planned: dict[str, float] = {}
    pred: dict[str, str | None] = {}
    for n in order:
        best = None
        for p in H.predecessors(n):
            if best is None or (finish[p], planned[p], -idx[p]) > (finish[best], planned[best], -idx[best]):
                best = p
        s = finish[best] if best is not None else 0.0
        start[n] = s
        finish[n] = s + H.nodes[n]["remaining"]
        planned[n] = (planned[best] if best is not None else 0.0) + H.nodes[n]["minutes"]
        pred[n] = best

    critical: list[str] = []
    total = planned_total = 0.0
    if order:
        end = max(order, key=lambda n: (finish[n], planned[n], -idx[n]))
        total, planned_total = finish[end], planned[end]
        c: str | None = end
        while c is not None:
            critical.append(c)
            c = pred[c]
        critical.reverse()

    return {
        "order": order,
        "wave": wave,
        "start": start,
        "finish": finish,
        "critical_path": critical,
        "total_minutes": total,
        "planned_minutes": planned_total,
        "cycles": cycles,
        "blocked": sorted(blocked),
    }


@app.post("/route")
def route(req: RouteRequest):
    """Routes wires through an enclosure. See routing.py for the method."""
    return route_wires(req)


@app.post("/impact")
def impact(req: ImpactRequest):
    """Everything downstream of the changed rows, by section, with the path to each. See impact.py."""
    return impact_of(req)


@app.post("/harness")
def harness(req: HarnessRequest):
    """Draws a wiring harness. WireViz runs as a separate process with a time limit; see harness.py."""
    try:
        return render_harness(req)
    except HarnessError as e:
        raise HTTPException(status_code=e.status, detail=e.message)


# ---- enclosure generation (plan 5.8). Additive: everything lives in enclosure.py.
import shutil as _shutil

from fastapi import HTTPException
from enclosure import BoxSpec as _BoxSpec, EnclosureError as _EnclosureError, YAPP_VERSION as _YAPP_VERSION, generate as _generate_yapp


@app.get("/enclosure/health")
def enclosure_health():
    exe = _shutil.which("openscad")
    return {"ok": exe is not None, "openscad": exe, "yapp": _YAPP_VERSION}


@app.post("/enclosure/yapp")
def enclosure_yapp(spec: _BoxSpec, timeout: float = 120.0):
    """Runs YAPP_Box in OpenSCAD for the spec. Answers 503 when OpenSCAD is missing, 504 on the time limit, 422 when it refuses."""
    if not _shutil.which("openscad"):
        raise HTTPException(503, "OpenSCAD is not installed in the planner container.")
    try:
        return _generate_yapp(spec, timeout=max(10.0, min(timeout, 300.0)))
    except _EnclosureError as e:
        text = str(e)
        raise HTTPException(504 if "did not finish" in text else 422, text)
