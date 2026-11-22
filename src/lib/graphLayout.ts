// Automatic layout for both schematic views, with elkjs (layered, left to right, ports on fixed
// sides). Only used for parts that have no saved position, and for the Tidy action.
import ELK from "elkjs/lib/elk.bundled.js";
import type { XY } from "@/lib/domain";

export type LayoutNode = { id: string; width: number; height: number; ports: { id: string; side: "WEST" | "EAST" | "NORTH" | "SOUTH"; x: number; y: number }[] };
export type LayoutEdge = { id: string; source: string; sourcePort: string; target: string; targetPort: string };

let elk: InstanceType<typeof ELK> | null = null;

/** Top-left positions by node id. Rejects only if elkjs itself fails. */
export async function elkLayout(nodes: LayoutNode[], edges: LayoutEdge[], spacing = { node: 60, layer: 120 }): Promise<Record<string, XY>> {
  return (await elkLayoutRouted(nodes, edges, spacing)).positions;
}

/**
 * Positions and elk's own orthogonal routes: for each edge, the points from the source port through every bend to the
 * target port, in the same coordinates as the positions. A route holds only while both of its nodes stay where elk put them.
 */
export async function elkLayoutRouted(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  /** `edgeNode`: how far a route keeps from a node it passes; the symbol view asks for room for the power and ground flags that hang off its symbols */
  spacing: { node: number; layer: number; edgeNode?: number; /** between two routes running side by side: room for a net label on each */ edgeEdge?: number } = { node: 60, layer: 120 },
): Promise<{ positions: Record<string, XY>; routes: Record<string, XY[]> }> {
  if (!nodes.length) return { positions: {}, routes: {} };
  elk ??= new ELK();
  const ids = new Set(nodes.map((n) => n.id));
  const ports = new Set(nodes.flatMap((n) => n.ports.map((p) => p.id)));
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(spacing.node),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing.layer),
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.componentComponent": String(spacing.node),
      ...(spacing.edgeNode ? { "elk.spacing.edgeNode": String(spacing.edgeNode), "elk.layered.spacing.edgeNodeBetweenLayers": String(spacing.edgeNode) } : {}),
      ...(spacing.edgeEdge ? { "elk.spacing.edgeEdge": String(spacing.edgeEdge), "elk.layered.spacing.edgeEdgeBetweenLayers": String(spacing.edgeEdge) } : {}),
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      layoutOptions: { "elk.portConstraints": "FIXED_POS" },
      ports: n.ports.map((p) => ({ id: p.id, x: p.x, y: p.y, width: 1, height: 1, layoutOptions: { "elk.port.side": p.side } })),
    })),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target && ports.has(e.sourcePort) && ports.has(e.targetPort))
      .map((e) => ({ id: e.id, sources: [e.sourcePort], targets: [e.targetPort] })),
  };
  const out = await elk.layout(graph);
  const pos: Record<string, XY> = {};
  for (const c of out.children ?? []) pos[c.id] = { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) };
  const routes: Record<string, XY[]> = {};
  for (const e of (out.edges ?? []) as { id: string; sections?: { startPoint: XY; endPoint: XY; bendPoints?: XY[] }[] }[]) {
    const sec = e.sections?.[0];
    if (sec) routes[e.id] = [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint].map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
  }
  return { positions: pos, routes };
}

export type FlowNode = { id: string; width: number; height: number };
export type FlowEdge = { id: string; source: string; target: string };

/** Layered left-to-right layout of a plain directed graph (no ports), top-left positions by node id. Cycles are tolerated. */
export async function elkFlow(nodes: FlowNode[], edges: FlowEdge[], spacing = { node: 36, layer: 56 }): Promise<Record<string, XY>> {
  if (!nodes.length) return {};
  elk ??= new ELK();
  const ids = new Set(nodes.map((n) => n.id));
  const out = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": String(spacing.node),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing.layer),
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.componentComponent": String(spacing.node),
    },
    children: nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target).map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const pos: Record<string, XY> = {};
  for (const c of out.children ?? []) pos[c.id] = { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) };
  return pos;
}
