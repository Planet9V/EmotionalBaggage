"""What a change affects: everything downstream of the changed rows.

The web app builds the dependency graph of a concept (see `impactGraph` in
src/lib/ai/drafts/impact.ts): nodes are rows, an edge runs from a row to a row
that depends on it (a requirement to the tests that check it, a part to the
wires that join it, a decision to the sections it unlocks, and so on). This
module returns every node reachable from the changed ones (`nx.descendants`),
grouped by section, each with the shortest path that reaches it, so the screen
can say why a row is affected.

Loops are allowed in the graph: reachability does not need an order.
"""
from collections import defaultdict

import networkx as nx
from pydantic import BaseModel, Field, model_validator


class ImpactNode(BaseModel):
    id: str = Field(min_length=1)
    section: str = ""


class ImpactRequest(BaseModel):
    nodes: list[ImpactNode] = []
    edges: list[tuple[str, str]] = []
    changed: list[str] = Field(min_length=1)

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
        for c in self.changed:
            if c not in ids:
                raise ValueError(f"changed node {c!r} is not in the graph")
        return self


def impact(req: ImpactRequest) -> dict:
    G = nx.DiGraph()
    for n in req.nodes:
        G.add_node(n.id, section=n.section)
    G.add_edges_from(req.edges)

    sources = list(dict.fromkeys(req.changed))
    affected: set[str] = set()
    for s in sources:
        affected |= nx.descendants(G, s)
    affected -= set(sources)

    # One shortest path per affected node, from whichever changed node is nearest.
    paths = nx.multi_source_dijkstra_path(G, set(sources)) if affected else {}

    rows = []
    for n in affected:
        rows.append({"id": n, "section": G.nodes[n]["section"], "path": paths[n]})
    # Nearest first, then by id, so the answer is the same every time.
    rows.sort(key=lambda r: (len(r["path"]), r["section"], r["id"]))

    by_section: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        by_section[r["section"]].append(r["id"])

    return {
        "changed": sources,
        "affected": rows,
        "by_section": dict(by_section),
        "total": len(rows),
    }
