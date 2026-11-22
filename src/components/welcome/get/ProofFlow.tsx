"use client";

// The claims view's diagram: what feeds the proof check (the example's claims, acceptance tests and requirements,
// each with what a link to it would count as today by the app's own check) and what waits on it (the ad drafts).
// React Flow, as the app's own diagrams are drawn; fixed, so it never takes the page's scroll.
import "@xyflow/react/dist/style.css";
import { memo, useMemo } from "react";
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import type { MarketData } from "../storyData";
import { useAnimated } from "../useAnimated";
import { GET_VIEWS } from "../content";
import { GET_PROVEN } from "./proven";

const STATE_TONE: Record<string, string> = {
  "verified claim": "var(--success)",
  "passing test": "var(--success)",
  requirement: "var(--net-signal)",
  "unverified claim": "var(--warning)",
  "test not passing": "var(--warning)",
  missing: "var(--danger)",
};
type ProofNodeData = { title: string; body: string; state?: string; strong?: boolean };
type ProofNode = Node<ProofNodeData, "proof">;
const HIDDEN = "!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent";
const ProofBox = memo(function ProofBox({ data }: NodeProps<ProofNode>) {
  return (
    <div className={`h-full w-full rounded-lg border px-3 py-2 ${data.strong ? "border-dutchOrange bg-[#1a1410]" : "border-white/15 bg-[#131519]"}`}>
      <p className="text-[13px] font-semibold leading-snug text-[#e8eaed]">{data.title}</p>
      <p className="mt-1 text-[12px] leading-snug text-[#a3a9b3]">{data.body}</p>
      {data.state ? (
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-[#c9ced6]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATE_TONE[data.state] ?? "var(--text-muted)" }} aria-hidden />
          {data.state}
        </p>
      ) : null}
      <Handle type="target" position={Position.Top} className={HIDDEN} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className={HIDDEN} isConnectable={false} />
    </div>
  );
});
const NODE_TYPES = { proof: ProofBox };

export default function ProofFlow({ market }: { market: MarketData }) {
  const c = GET_VIEWS.claim;
  const animated = useAnimated();
  const { nodes, edges } = useMemo(() => {
    // the kinds of proof in a row on top, the check under them, the ad drafts waiting under it
    const pool = market.positioning.pool;
    const W = 176;
    const GAP = 14;
    const row = pool.length * W + (pool.length - 1) * GAP;
    const nodes: ProofNode[] = pool.map((p, i) => ({
      id: `pool-${i}`,
      type: "proof",
      position: { x: i * (W + GAP), y: 0 },
      width: W,
      height: 96,
      data: { title: p.label, body: GET_PROVEN(p), state: p.state },
      draggable: false,
      selectable: false,
    }));
    const CW = 340;
    nodes.push({ id: "check", type: "proof", position: { x: (row - CW) / 2, y: 160 }, width: CW, height: 84, data: { title: c.check, body: c.checkBody, strong: true }, draggable: false, selectable: false });
    nodes.push({ id: "ads", type: "proof", position: { x: (row - 260) / 2, y: 300 }, width: 260, height: 90, data: { title: c.ads, body: c.adsBody(market.ads.drafts.length), state: market.ads.drafts[0]?.status }, draggable: false, selectable: false });
    const edges: Edge[] = [
      ...pool.map((p, i) => ({ id: `e-${i}`, source: `pool-${i}`, target: "check", animated, style: { stroke: STATE_TONE[p.state] ?? "#8b919b", strokeWidth: 1.5 } })),
      { id: "e-ads", source: "check", target: "ads", animated, style: { stroke: "#E05A10", strokeWidth: 1.8 } },
    ];
    return { nodes, edges };
  }, [market, animated, c]);
  return (
    <div className="h-[380px] w-full" aria-hidden>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} fitView fitViewOptions={{ padding: 0.04, maxZoom: 1.4 }} proOptions={{ hideAttribution: true }} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false} panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} style={{ background: "transparent" }} />
    </div>
  );
}
