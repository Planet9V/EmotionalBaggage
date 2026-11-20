"""Order-of-operations planner.

The web app sends a concept's step graph; NetworkX returns the build order,
the parallel waves, earliest start/finish per step and the critical path.
"""
from fastapi import FastAPI
from pydantic import BaseModel
import networkx as nx

app = FastAPI(title="Concept-to-realization planner")


class Node(BaseModel):
    id: str
    minutes: float = 0


class Graph(BaseModel):
    nodes: list[Node]
    edges: list[tuple[str, str]] = []


@app.get("/health")
def health():
    return {"ok": True, "networkx": nx.__version__}


@app.post("/plan")
def plan(g: Graph):
    G = nx.DiGraph()
    for n in g.nodes:
        G.add_node(n.id, minutes=n.minutes)
    for a, b in g.edges:
        if a in G and b in G and a != b:
            G.add_edge(a, b)

    cycles = [list(c) for c in nx.simple_cycles(G)]
    if cycles:
        # Plan what can be planned: drop every step that sits on a cycle and report them.
        G.remove_nodes_from({n for c in cycles for n in c})

    wave, order = {}, []
    for i, gen in enumerate(nx.topological_generations(G)):
        for n in sorted(gen):
            wave[n] = i
            order.append(n)

    start, finish, pred = {}, {}, {}
    for n in nx.topological_sort(G):
        s, p = 0.0, None
        for a in G.predecessors(n):
            if finish[a] > s or p is None:
                s, p = max(s, finish[a]), a if finish[a] >= s else p
        start[n], finish[n], pred[n] = s, s + G.nodes[n]["minutes"], p

    critical, total = [], 0.0
    if finish:
        end = max(finish, key=finish.get)
        total = finish[end]
        while end is not None:
            critical.insert(0, end)
            end = pred[end]

    return {
        "order": order,
        "wave": wave,
        "start": start,
        "finish": finish,
        "critical_path": critical,
        "total_minutes": total,
        "cycles": cycles,
    }
