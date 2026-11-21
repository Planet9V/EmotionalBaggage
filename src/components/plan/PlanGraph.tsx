"use client";

import "@xyflow/react/dist/style.css";
import { memo, useMemo } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Plan, PlanNode } from "@/lib/types";
import { fmtMinutes } from "@/lib/format";

const ORANGE = "#E05A10";
const COL = 300;
const ROW = 132;

type StepData = { step: PlanNode; selected: boolean; blocked: boolean };
type StepNodeType = Node<StepData, "step">;

function StepNodeView({ data }: NodeProps<StepNodeType>) {
  const { step, selected, blocked } = data;
  const ring = blocked
    ? "border-danger"
    : step.critical
      ? "border-dutchOrange"
      : "border-hairline";
  return (
    <div
      className={`w-[248px] rounded-xl border bg-surface px-3 py-2.5 text-left shadow-xs transition-shadow duration-150 ${ring} ${
        selected ? "shadow-[0_0_20px_rgba(224,90,16,0.15)] ring-2 ring-dutchOrange" : "hover:shadow-md"
      }`}
    >
      <Handle type="target" position={Position.Left} className="h-2! w-2! border-0! bg-transparent!" />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-link">{step.id}</span>
        <StatusBadge tone={statusTone(step.status)} className="px-2! py-0! text-[10px]!">{step.status}</StatusBadge>
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-primary">{step.title}</p>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted">
        <span>{fmtMinutes(step.minutes)}</span>
        <span>{blocked ? "in a loop" : `${step.start} to ${step.finish} min`}</span>
      </div>
      <Handle type="source" position={Position.Right} className="h-2! w-2! border-0! bg-transparent!" />
    </div>
  );
}

const nodeTypes = { step: memo(StepNodeView) };

/** Steps left to right by wave, stacked inside a wave; the critical path drawn in orange. */
export function PlanGraph({ plan, selectedId, onSelect }: { plan: Plan; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { nodes, edges } = useMemo(() => {
    const inLoop = new Set(plan.cycles.flat());
    const maxWave = plan.nodes.reduce((m, n) => Math.max(m, n.wave), -1);
    const byWave = new Map<number, PlanNode[]>();
    const orderIdx = new Map(plan.order.map((id, i) => [id, i]));
    for (const n of plan.nodes) {
      const w = n.wave < 0 ? maxWave + 1 : n.wave;
      byWave.set(w, [...(byWave.get(w) ?? []), n]);
    }
    const nodes: StepNodeType[] = [];
    for (const [w, list] of byWave) {
      list.sort((a, b) => (orderIdx.get(a.id) ?? 1e9) - (orderIdx.get(b.id) ?? 1e9));
      list.forEach((n, i) =>
        nodes.push({
          id: n.id,
          type: "step",
          position: { x: w * COL, y: (i - (list.length - 1) / 2) * ROW },
          data: { step: n, selected: n.id === selectedId, blocked: inLoop.has(n.id) },
          draggable: false,
          connectable: false,
        })
      );
    }
    const critPairs = new Set<string>();
    for (let i = 1; i < plan.criticalPath.length; i++) critPairs.add(`${plan.criticalPath[i - 1]}>${plan.criticalPath[i]}`);
    const edges: Edge[] = plan.nodes.flatMap((n) =>
      n.after.map((a) => {
        const crit = critPairs.has(`${a}>${n.id}`);
        const loop = inLoop.has(a) && inLoop.has(n.id);
        const color = loop ? "var(--danger)" : crit ? ORANGE : "var(--border-hairline)";
        return {
          id: `${a}>${n.id}`,
          source: a,
          target: n.id,
          type: "smoothstep",
          style: { stroke: color, strokeWidth: crit ? 2 : 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        } satisfies Edge;
      })
    );
    return { nodes, edges };
  }, [plan, selectedId]);

  return (
    <div className="h-[460px] w-full overflow-hidden rounded-xl border border-hairline bg-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        defaultViewport={{ x: 32, y: 190, zoom: 0.85 }}
        minZoom={0.2}
        panOnScroll
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-hairline)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
