"use client";

// "The whole trip on one map": the seven stages in a path, what each produces beneath it, and what feeds what
// across stages, drawn with React Flow as the app's own diagrams are. Pick a node (click, or Tab to it and press
// Enter or Space) and everything downstream of it lights up, with one line saying what that is.
//
// Loaded by LifecycleMap once the page runs (React Flow needs a browser to measure and lay out). The page's scrolling is never taken: no zoom on scroll, and on a phone no pan or zoom at all (a fitted, still
// layout). The dashes on the lit edges move for a few seconds after a pick, then rest; never under reduced motion.
import "@xyflow/react/dist/style.css";
import { memo, useEffect, useMemo, useState } from "react";
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useAnimated } from "./useAnimated";
import { MAP, MAP_LABEL as LABEL } from "./content";

const ORANGE = "#E05A10";
const FLOW_MS = 4500;

const OWNER = new Map<string, string>(MAP.stages.flatMap((s) => s.makes.map(([id]) => [id, s.key] as [string, string])));

/** Everything fed, directly or through something else, by the node: a stage stands for all it makes. */
function downstream(id: string): string[] {
  const start = MAP.stages.find((s) => s.key === id)?.makes.map(([m]) => m) ?? [id];
  const seen = new Set<string>(start);
  const queue = [...start];
  while (queue.length) {
    const from = queue.shift()!;
    for (const [a, b] of MAP.feeds) {
      if (a !== from || seen.has(b)) continue;
      seen.add(b);
      queue.push(b);
    }
  }
  // picking a stage lights what it makes too; picking one thing lights only what comes after it
  return [...seen].filter((n) => n !== id);
}

function caption(id: string | null) {
  if (!id) return MAP.idle;
  const hit = downstream(id).map((n) => LABEL.get(n)!.toLowerCase());
  const name = LABEL.get(id)!;
  if (!hit.length) return `${name} is the end of the line: nothing else is built from it.`;
  return `Change the ${name.toLowerCase()} and ${hit.length === 1 ? "this depends" : `these ${hit.length} depend`} on it: ${hit.join(", ")}.`;
}

type Data = { label: string; n?: string; picked: boolean; lit: boolean; tall: boolean; onPick: () => void };
type MapNode = Node<Data, "stage" | "made">;

const HIDDEN = "!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

const StageNode = memo(function StageNode({ data }: NodeProps<MapNode>) {
  return (
    <button
      type="button"
      aria-pressed={data.picked}
      onClick={data.onPick}
      className={`nodrag nopan pointer-events-auto flex h-full w-full items-center gap-2 rounded-lg border-2 px-3 text-left text-sm font-semibold transition-colors duration-150 ${data.picked ? "border-dutchOrange bg-action text-white" : "border-[var(--text-primary)] bg-surface text-primary hover:border-dutchOrange"}`}
    >
      <span className={`font-mono text-xs ${data.picked ? "text-white" : "text-link"}`}>{data.n}</span>
      {data.label}
      <Handle type="target" position={data.tall ? Position.Top : Position.Left} className={HIDDEN} isConnectable={false} />
      <Handle type="source" position={data.tall ? Position.Bottom : Position.Right} className={HIDDEN} isConnectable={false} />
    </button>
  );
});

const MadeNode = memo(function MadeNode({ data }: NodeProps<MapNode>) {
  return (
    <button
      type="button"
      aria-pressed={data.picked}
      onClick={data.onPick}
      className={`nodrag nopan pointer-events-auto flex h-full w-full items-center rounded-md border px-2.5 text-left text-xs font-medium transition-colors duration-150 ${
        data.picked ? "border-dutchOrange bg-action text-white" : data.lit ? "border-dutchOrange bg-[var(--accent-orange-subtle)] text-primary" : "border-hairline bg-surface text-secondary hover:border-dutchOrange hover:text-primary"
      }`}
    >
      {data.label}
      {data.lit && !data.picked ? <span className="sr-only"> (depends on your pick)</span> : null}
      <Handle type="target" position={Position.Left} id="in" className={HIDDEN} isConnectable={false} />
      <Handle type="target" position={Position.Right} id="inR" className={HIDDEN} isConnectable={false} />
      <Handle type="source" position={Position.Right} id="out" className={HIDDEN} isConnectable={false} />
    </button>
  );
});

const nodeTypes = { stage: StageNode, made: MadeNode };

// Two layouts: stages across with what they make beneath (wide), or stages down with what they make beside (phone).
const WIDE = { stageW: 132, stageH: 40, madeW: 132, madeH: 32, colGap: 34, rowGap: 12, top: 60, stagger: 22 };
const TALL = { stageW: 116, stageH: 36, madeW: 136, madeH: 30, rowGap: 8, blockGap: 18, left: 132 };

function build(tall: boolean, picked: string | null, flowing: boolean, onPick: (id: string) => void) {
  const lit = new Set(picked ? downstream(picked) : []);
  const nodes: MapNode[] = [];
  let y = 0;
  MAP.stages.forEach((s, i) => {
    const sx = tall ? 0 : i * (WIDE.stageW + WIDE.colGap);
    const blockH = s.makes.length * (TALL.madeH + TALL.rowGap) - TALL.rowGap;
    nodes.push({
      id: s.key,
      type: "stage",
      position: { x: sx, y: tall ? y + (blockH - TALL.stageH) / 2 : 0 },
      width: tall ? TALL.stageW : WIDE.stageW,
      height: tall ? TALL.stageH : WIDE.stageH,
      data: { label: s.name, n: s.n, picked: picked === s.key, lit: false, tall, onPick: () => onPick(s.key) },
    });
    s.makes.forEach(([id, label], j) => {
      nodes.push({
        id,
        type: "made",
        // on the wide layout every other column sits half a row lower, so a feed that skips a stage runs through the gaps
        position: tall ? { x: TALL.left, y: y + j * (TALL.madeH + TALL.rowGap) } : { x: sx, y: WIDE.top + (i % 2) * WIDE.stagger + j * (WIDE.madeH + WIDE.rowGap) },
        width: tall ? TALL.madeW : WIDE.madeW,
        height: tall ? TALL.madeH : WIDE.madeH,
        data: { label, picked: picked === id, lit: lit.has(id), tall, onPick: () => onPick(id) },
      });
    });
    y += blockH + TALL.blockGap;
  });
  const path: Edge[] = MAP.stages.slice(1).map((s, i) => ({
    id: `${MAP.stages[i]!.key}>${s.key}`,
    source: MAP.stages[i]!.key,
    target: s.key,
    type: "straight",
    animated: flowing && !picked,
    style: { stroke: "var(--text-primary)", strokeWidth: 2 },
  }));
  const feeds: Edge[] = MAP.feeds.map(([a, b]) => {
    const on = (a === picked || lit.has(a) || MAP.stages.some((s) => s.key === picked && s.makes.some(([m]) => m === a))) && lit.has(b);
    return {
      id: `${a}>${b}`,
      source: a,
      target: b,
      sourceHandle: "out",
      // across stages on the wide layout a feed runs left to right; otherwise it loops round the right-hand side
      targetHandle: tall || OWNER.get(a) === OWNER.get(b) ? "inR" : "in",
      type: "default",
      animated: on && flowing,
      style: { stroke: on ? ORANGE : "var(--text-muted)", strokeWidth: on ? 2 : 1, opacity: picked && !on ? 0.3 : 0.8 },
    };
  });
  return { nodes, edges: [...path, ...feeds] };
}

export default function LifecycleFlow({ tall }: { tall: boolean }) {
  const animated = useAnimated();
  const [picked, setPicked] = useState<string | null>(null);
  const [flowing, setFlowing] = useState(false);
  // dashes move for a few seconds after the map appears and after each pick, then rest
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!animated) return;
    const on = window.setTimeout(() => setFlowing(true), 0);
    const off = window.setTimeout(() => setFlowing(false), FLOW_MS);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [animated, pulse]);
  const { nodes, edges } = useMemo(
    () =>
      build(tall, picked, flowing, (id) => {
        setPicked((p) => (p === id ? null : id));
        setPulse((n) => n + 1);
      }),
    [tall, picked, flowing],
  );
  return (
    <>
      <div className={tall ? "h-[700px]" : "h-[236px]"}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: tall ? 0.08 : 0.03 }}
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          aria-label="The seven stages, what each produces and what feeds what"
        />
      </div>
      <p aria-live="polite" className="mt-4 min-h-[4.5rem] rounded-lg border border-hairline bg-surface px-4 py-3 text-sm leading-relaxed text-primary lg:min-h-[3rem]">
        {caption(picked)}
      </p>
    </>
  );
}

