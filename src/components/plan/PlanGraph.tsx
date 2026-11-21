"use client";

import "@xyflow/react/dist/style.css";
import { memo, useEffect, useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Plan, PlanNode } from "@/lib/types";
import { fmtMinutes } from "@/lib/format";
import { elkFlow } from "@/lib/graphLayout";
import type { XY } from "@/lib/domain";

const ORANGE = "#E05A10";
const NODE_W = 248;
const NODE_H = 88;

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
        <span>{blocked ? "in a loop" : step.wave < 0 ? "no time yet" : `${step.start} to ${step.finish} min`}</span>
      </div>
      <Handle type="source" position={Position.Right} className="h-2! w-2! border-0! bg-transparent!" />
    </div>
  );
}

const nodeTypes = { step: memo(StepNodeView) };

/** Steps left to right in the order they can start (elkjs, layered), the critical path drawn in orange. */
export function PlanGraph({ plan, selectedId, onSelect }: { plan: Plan; selectedId: string | null; onSelect: (id: string | null) => void }) {
  // the arrangement depends on the steps and what they wait on, not on which one is selected
  const shape = plan.nodes.map((n) => `${n.id}>${n.after.join(",")}`).join("|");
  const [pos, setPos] = useState<{ shape: string; at: Record<string, XY> } | null>(null);
  useEffect(() => {
    let live = true;
    elkFlow(
      plan.nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
      plan.nodes.flatMap((n) => n.after.map((a) => ({ id: `${a}>${n.id}`, source: a, target: n.id }))),
    )
      .then((at) => live && setPos({ shape, at }))
      .catch(() => live && setPos({ shape, at: {} }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` stands for plan.nodes
  }, [shape]);
  const at = pos?.shape === shape ? pos.at : null;

  const { nodes, edges } = useMemo(() => {
    const inLoop = new Set(plan.cycles.flat());
    const nodes: StepNodeType[] = at
      ? plan.nodes.map((n, i) => ({
          id: n.id,
          type: "step",
          position: at[n.id] ?? { x: 0, y: i * (NODE_H + 24) },
          data: { step: n, selected: n.id === selectedId, blocked: inLoop.has(n.id) },
          draggable: false,
          connectable: false,
        }))
      : [];
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
  }, [plan, selectedId, at]);

  return (
    <div className="h-[460px] w-full overflow-hidden rounded-xl border border-hairline bg-canvas">
      <ReactFlow
        key={at ? "ready" : "waiting"}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
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
