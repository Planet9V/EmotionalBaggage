"use client";

/**
 * The decision tree as a React Flow chart, root at the left. A decision card carries
 * its key, its state and a thin status bar; an expanded decision shows its options
 * stacked under the card and its children to the right. The chain from the root to the
 * selected decision runs dashed orange; "depends on" links are dotted curves underneath.
 */
import "@xyflow/react/dist/style.css";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  BaseEdge,
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check, Maximize2 } from "lucide-react";
import type { Decision } from "@/lib/domain";
import {
  CARD_H,
  CARD_W,
  OPT_H,
  OPT_W,
  ancestry,
  chosenOption,
  layout,
  shownChildren,
  stateOf,
  stateWord,
  type DState,
  type LayoutInput,
  type Tree,
} from "./model";

const ORANGE = "#E05A10";

type CardData = {
  d: Decision;
  state: DState;
  word: string;
  selected: boolean;
  onPath: boolean;
  /** children hidden while collapsed (tree view only) */
  hidden: number;
  open: boolean;
  hasKids: boolean;
};
type OptData = { label: string; chosen: boolean; dim: boolean; onPath: boolean };
type CardNode = Node<CardData, "decision">;
type OptNode = Node<OptData, "option">;

const BAR: Record<DState, string> = {
  decided: "bg-dutchOrange",
  open: "bg-hairline",
  waiting: "bg-danger",
  blocked: "bg-danger",
};
const WORD: Record<DState, string> = {
  decided: "text-link",
  open: "text-muted",
  waiting: "text-danger",
  blocked: "text-danger",
};

const hidden = "h-1.5! w-1.5! min-h-0! min-w-0! border-0! bg-transparent!";

function DecisionCard({ data }: NodeProps<CardNode>) {
  const { d, state, word, selected, onPath, hidden: more, open, hasKids } = data;
  return (
    <div
      className={`relative flex cursor-pointer flex-col rounded-xl border bg-surface px-3.5 pb-2.5 pt-2.5 text-left transition-[border-color,box-shadow] duration-150 ${
        selected
          ? "border-dutchOrange shadow-[0_0_20px_rgba(224,90,16,0.15)]"
          : onPath
            ? "border-dutchOrange/40 shadow-xs"
            : "border-hairline shadow-xs hover:border-dutchOrange/40"
      }`}
      style={{ width: CARD_W, height: CARD_H }}
      data-testid="decision-node"
      data-key={d.key}
      data-state={state}
    >
      <Handle type="target" position={Position.Left} className={hidden} />
      <p className="flex min-w-0 items-baseline gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="shrink-0 text-link">{d.key}</span>
        <span className="text-muted" aria-hidden>
          ·
        </span>
        <span className={`truncate ${WORD[state]}`}>{word}</span>
      </p>
      <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-primary">{d.question}</p>
      <span className={`mt-auto block h-[3px] w-full rounded-full ${BAR[state]}`} aria-hidden />
      {hasKids && (
        <span
          className={`absolute -right-3 top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full border px-1.5 font-mono text-[10.5px] ${
            open ? "border-hairline bg-surface text-muted" : "border-dutchOrange/40 bg-surface text-link"
          }`}
        >
          <span aria-hidden>{open ? "–" : `+${more}`}</span>
          <span className="sr-only">{open ? "Expanded" : `${more} more`}</span>
        </span>
      )}
      <Handle type="source" position={Position.Right} className={hidden} />
      <Handle id="opt" type="source" position={Position.Bottom} className={hidden} style={{ left: 12 }} />
    </div>
  );
}

function OptionChip({ data }: NodeProps<OptNode>) {
  const { label, chosen, dim, onPath } = data;
  return (
    <div
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[12px] font-medium transition-colors duration-150 ${
        chosen
          ? "border-dutchOrange bg-dutchOrange text-white"
          : onPath
            ? "border-dutchOrange/40 bg-surface text-primary"
            : "border-hairline bg-surface text-secondary hover:border-dutchOrange/40"
      } ${dim ? "opacity-50" : ""}`}
      style={{ width: OPT_W, height: OPT_H }}
      data-testid="decision-option-node"
      data-chosen={chosen ? "true" : "false"}
    >
      <Handle type="target" position={Position.Left} className={hidden} />
      {chosen ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-current opacity-60" aria-hidden />}
      <span className="truncate">{label}</span>
      {chosen && <span className="sr-only">(chosen)</span>}
      <Handle type="source" position={Position.Right} className={hidden} />
    </div>
  );
}

type DepData = { met: boolean };
function DependsEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<DepData, "depends">>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const met = !!data?.met;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: met ? "var(--text-muted)" : "var(--danger)", strokeWidth: 1.4, strokeDasharray: "1 5", strokeLinecap: "round", opacity: 0.85 }}
      />
      <EdgeLabelRenderer>
        <span
          className={`nodrag nopan pointer-events-none absolute rounded-full border bg-surface px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em] ${met ? "border-hairline text-muted" : "border-hairline text-danger"}`}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
        >
          depends on
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { decision: memo(DecisionCard), option: memo(OptionChip) };
const edgeTypes = { depends: DependsEdge };

export type FlowProps = {
  all: Decision[];
  byKey: Map<string, Decision>;
  tree: Tree;
  selected: string | null;
  expanded: Set<string>;
  /** the route view: only these decisions, with only their chosen option */
  only: Set<string> | null;
  onSelect: (key: string) => void;
  /** a user pan, zoom or click on the empty pane */
  onUserMove: () => void;
  /** reduced motion: move without easing */
  instant: boolean;
};

function Flow({ all, byKey, tree, selected, expanded, only, onSelect, onUserMove, instant }: FlowProps) {
  const rf = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const input: LayoutInput = { tree, byKey, expanded, only, chosenOnly: !!only };
    const placed = layout(input);
    const visible = new Set(placed.filter((p) => p.kind === "decision").map((p) => p.key));
    const path = selected && visible.has(selected) ? ancestry(selected, byKey, tree) : [];
    const onPath = new Set(path);
    // a child hung off an option puts that option on the path too
    const optOnPath = new Set<string>();
    for (const k of path) {
      const via = String(byKey.get(k)?.item.data.viaOption ?? "");
      const p = byKey.get(k)?.parent;
      if (via && p && onPath.has(p)) optOnPath.add(`${p}::${via}`);
    }

    const nodes: (CardNode | OptNode)[] = placed.map((p) => {
      const d = byKey.get(p.key)!;
      if (p.kind === "decision") {
        const kids = tree.children.get(p.key) ?? [];
        const shown = shownChildren(p.key, input);
        const state = stateOf(d, all);
        return {
          id: `d:${p.key}`,
          type: "decision",
          position: { x: p.x, y: p.y },
          width: CARD_W,
          height: CARD_H,
          draggable: false,
          connectable: false,
          data: {
            d,
            state,
            word: stateWord(d, all, byKey),
            selected: p.key === selected,
            onPath: onPath.has(p.key),
            hidden: kids.length - shown.length,
            open: shown.length > 0 && shown.length === kids.length,
            hasKids: kids.length > 0,
          },
        } satisfies CardNode;
      }
      const chosen = d.chosen === p.option;
      const o = d.options.find((x) => x.id === p.option)!;
      return {
        id: `o:${p.key}::${p.option}`,
        type: "option",
        position: { x: p.x, y: p.y },
        width: OPT_W,
        height: OPT_H,
        draggable: false,
        connectable: false,
        data: { label: o.label, chosen, dim: !!d.chosen && !chosen, onPath: optOnPath.has(`${p.key}::${p.option}`) },
      } satisfies OptNode;
    });

    const edges: Edge[] = [];
    const tree_ = (id: string, source: string, target: string, on: boolean, sourceHandle?: string) =>
      edges.push({
        id,
        source,
        target,
        sourceHandle,
        type: "smoothstep",
        animated: on,
        zIndex: on ? 2 : 0,
        selectable: false,
        focusable: false,
        style: on
          ? { stroke: ORANGE, strokeWidth: 2, strokeDasharray: "6 4" }
          : { stroke: "var(--text-muted)", strokeWidth: 1.1, opacity: 0.4 },
      });
    for (const p of placed) {
      if (p.kind === "option") {
        // the short rail from the card down to each option
        const on = optOnPath.has(`${p.key}::${p.option}`);
        edges.push({
          id: `r:${p.key}::${p.option}`,
          source: `d:${p.key}`,
          sourceHandle: "opt",
          target: `o:${p.key}::${p.option}`,
          type: "smoothstep",
          selectable: false,
          focusable: false,
          zIndex: on ? 2 : 0,
          style: on ? { stroke: ORANGE, strokeWidth: 1.6 } : { stroke: "var(--text-muted)", strokeWidth: 1, opacity: 0.35 },
        });
        continue;
      }
      const d = byKey.get(p.key)!;
      const parent = tree.looped.has(p.key) ? "" : d.parent;
      if (!parent || !visible.has(parent)) continue;
      const via = String(d.item.data.viaOption ?? "");
      const viaShown = via && nodes.some((n) => n.id === `o:${parent}::${via}`);
      const on = onPath.has(p.key) && onPath.has(parent);
      if (viaShown) tree_(`t:${parent}>${p.key}`, `o:${parent}::${via}`, `d:${p.key}`, on);
      else tree_(`t:${parent}>${p.key}`, `d:${parent}`, `d:${p.key}`, on);
    }
    // depends-on links between drawn decisions: dotted curves, so they read apart from the stepped tree edges
    for (const d of all) {
      if (!visible.has(d.key)) continue;
      for (const k of d.dependsOn) {
        if (k === d.key || !visible.has(k)) continue;
        edges.push({
          id: `dep:${k}>${d.key}`,
          source: `d:${k}`,
          target: `d:${d.key}`,
          type: "depends",
          selectable: false,
          focusable: false,
          data: { met: !!byKey.get(k)?.chosen },
        });
      }
    }
    return { nodes, edges };
  }, [all, byKey, tree, selected, expanded, only]);

  // frame the selected decision with what hangs off it, whenever the selection or the shape changes
  const shape = useMemo(() => nodes.map((n) => n.id).join("|"), [nodes]);
  const lastFrame = useRef("");
  useEffect(() => {
    if (!selected) return;
    const frame = `${selected}|${shape}|${only ? "route" : "tree"}`;
    if (frame === lastFrame.current) return;
    lastFrame.current = frame;
    const ids = nodes
      .filter((n) => n.id === `d:${selected}` || n.id.startsWith(`o:${selected}::`) || (n.type === "decision" && (n.data as CardData).d.parent === selected))
      .map((n) => ({ id: n.id }));
    // the route view is short: frame all of it; the tree frames the selection with what hangs off it
    const go = () =>
      rf.fitView({ nodes: only || !ids.length ? undefined : ids, duration: instant ? 0 : 700, padding: only ? 0.15 : 0.3, maxZoom: 1.05, minZoom: 0.3 });
    // the first frame can land before the pane is measured; frame again once it is
    const timers = [window.setTimeout(go, 40), window.setTimeout(go, 380)];
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      lastFrame.current = "";
    };
  }, [selected, shape, nodes, rf, instant, only]);

  const fitAll = useCallback(() => {
    onUserMove();
    void rf.fitView({ duration: instant ? 0 : 600, padding: 0.12, maxZoom: 1 });
  }, [rf, instant, onUserMove]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={1.6}
      onNodeClick={(_, n) => onSelect(n.id.startsWith("o:") ? n.id.slice(2).split("::")[0] : n.id.slice(2))}
      onPaneClick={onUserMove}
      onMoveStart={(e) => {
        // programmatic moves have no event; only a person's pan or zoom stops the walkthrough
        if (e) onUserMove();
      }}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent!"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="var(--border-hairline)" />
      <Controls showInteractive={false} showFitView={false} position="bottom-left" className="rounded-md! shadow-xs!" />
      <button
        type="button"
        onClick={fitAll}
        className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-secondary shadow-xs transition-colors duration-150 hover:border-dutchOrange hover:text-link"
        data-testid="decisions-fit"
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        Fit
      </button>
    </ReactFlow>
  );
}

export function DecisionFlow(props: FlowProps) {
  return (
    <div className="relative h-full w-full" data-testid="decisions-flow">
      <ReactFlowProvider>
        <Flow {...props} />
      </ReactFlowProvider>
    </div>
  );
}

/** Used by the caption and the detail: the chosen option's label, or the raw id when the option is gone. */
export const chosenLabel = (d: Decision) => chosenOption(d)?.label ?? d.chosen;
