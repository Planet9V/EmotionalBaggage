"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Connection,
  type NodeChangeset,
  type Node,
} from "@xyflow/react";
import { GripVertical, MousePointerClick } from "lucide-react";
import { NET_COLOR, type NetClass, type Wire } from "@/lib/domain";
import { CLASSES, CLASS_LABEL, MISSING_PIN, type Graph, type Part, type XY } from "./model";
import { SchematicContext, edgeTypes, nodeTypes, type PartNodeType, type WireEdgeType } from "./nodes";
import type { Selection } from "./SidePanel";
import { Card } from "@/components/ui/Card";

const DRAG_TYPE = "application/x-schematic-part";

export type ConnectRequest = { from: string; fromPin: string; to: string; toPin: string };

type Props = {
  graph: Graph;
  wires: Wire[];
  sel: Selection;
  hidden: Set<NetClass>;
  onToggleClass: (c: NetClass) => void;
  hoverNet: string | null;
  highlight: Set<string>;
  onMove: (moves: Record<string, XY>) => void;
  onDragStop: (ids: string[]) => void;
  onSelect: (s: Selection) => void;
  onConnect: (c: ConnectRequest) => void;
  onEditWire: (w: Wire) => void;
  onAddPin: (ref: string) => void;
  palette: Part[];
  onPlace: (ref: string, at: XY) => void;
  banner?: React.ReactNode;
  /** wires to emphasise: the selected wire, or every wire on a selected pin */
  litWires?: Set<number>;
  onPickPin?: (ref: string, pin: string) => void;
};

const refOf = (nodeId: string) => nodeId.slice(2);
const pinOf = (handle: string | null) => {
  const p = (handle ?? "").replace(/^pin:/, "");
  return p === MISSING_PIN ? "" : p;
};

/** The React Flow canvas. Must sit inside a ReactFlowProvider. */
export function SchematicCanvas(p: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const [dropping, setDropping] = useState(false);
  const { graph, sel, hidden, hoverNet, onMove, onDragStop, onSelect, onConnect, onEditWire } = p;

  const nodes = useMemo(() => {
    return graph.nodes.map(
      (n): PartNodeType => ({
        id: n.id,
        type: "part",
        position: n.pos,
        data: { ref: n.ref, title: n.title, ghost: n.ghost, pins: n.pins },
        selected: sel?.kind === "part" && sel.ref === n.ref,
        measured: measured[n.id],
      })
    );
  }, [graph, sel, measured]);

  const edges = useMemo(() => {
    const out: WireEdgeType[] = [];
    for (const s of graph.segments) {
      if (hidden.has(s.wire.netClass)) continue;
      const selected = sel?.kind === "wire" && sel.id === s.wire.item.id;
      out.push({
        id: s.id,
        type: "wire",
        source: s.source,
        sourceHandle: s.sourceHandle,
        target: s.target,
        targetHandle: s.targetHandle,
        selected,
        zIndex: selected ? 10 : 0,
        data: { wire: s.wire, label: s.label, dim: !!hoverNet && s.wire.net !== hoverNet, emph: (!!hoverNet && s.wire.net === hoverNet) || !!p.litWires?.has(s.wire.item.id) },
      });
    }
    return out;
  }, [graph, hidden, sel, hoverNet, p.litWires]);

  const onNodesChange = useCallback(
    (changes: NodeChangeset<PartNodeType>) => {
      const moves: Record<string, XY> = {};
      const dims: Record<string, { width: number; height: number }> = {};
      for (const c of changes) {
        if (c.type === "position" && c.position) moves[c.id] = { x: Math.round(c.position.x), y: Math.round(c.position.y) };
        if (c.type === "dimensions" && c.dimensions) dims[c.id] = c.dimensions;
      }
      if (Object.keys(moves).length) onMove(moves);
      if (Object.keys(dims).length) setMeasured((m) => ({ ...m, ...dims }));
    },
    [onMove]
  );

  const wireById = useMemo(() => new Map(p.wires.map((w) => [w.item.id, w])), [p.wires]);
  const wireOfEdge = (e: WireEdgeType) => e.data?.wire ?? null;

  const isValidConnection = useCallback((c: Connection | WireEdgeType) => {
    if (!c.source.startsWith("p:") || !c.target.startsWith("p:")) return false;
    return !(c.source === c.target && c.sourceHandle === c.targetHandle);
  }, []);

  const handleConnect = useCallback(
    (c: Connection) => {
      if (!c.source.startsWith("p:") || !c.target.startsWith("p:")) return;
      onConnect({ from: refOf(c.source), fromPin: pinOf(c.sourceHandle), to: refOf(c.target), toPin: pinOf(c.targetHandle) });
    },
    [onConnect]
  );

  const counts = useMemo(() => {
    const m = new Map<NetClass, number>();
    for (const w of p.wires) m.set(w.netClass, (m.get(w.netClass) ?? 0) + 1);
    return m;
  }, [p.wires]);

  const placeAtCentre = (ref: string) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const at = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    p.onPlace(ref, { x: Math.round(at.x - 108), y: Math.round(at.y - 40) });
  };

  return (
    <SchematicContext.Provider value={{ onAddPin: p.onAddPin, highlight: p.highlight, onPickPin: p.onPickPin }}>
      {p.palette.length > 0 && (
        <Card variant="flat" className="mb-3 px-3 py-2.5">
          <p className="text-xs text-secondary">
            <span className="font-medium text-primary">Not on the schematic yet.</span> Drag a part onto the canvas, or press Place, then name its first pin.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {p.palette.map((part) => (
              <li key={part.item.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, part.ref);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="group inline-flex cursor-grab items-center gap-1 rounded-md border border-hairline bg-canvas py-1 pl-1 pr-1 text-xs transition-colors duration-150 hover:border-dutchOrange/40 active:cursor-grabbing"
                  title={part.spec}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted" aria-hidden />
                  <span className="font-mono font-semibold text-link">{part.ref}</span>
                  <span className="max-w-[160px] truncate text-secondary">{part.title}</span>
                  <button
                    type="button"
                    onClick={() => placeAtCentre(part.ref)}
                    className="ml-1 rounded-sm px-1.5 py-0.5 text-[11px] text-link transition-colors duration-150 hover:bg-dutchOrange/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                    aria-label={`Place ${part.ref} on the canvas`}
                  >
                    Place
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div
        ref={wrap}
        data-testid="pins-canvas"
        className={`schematic-canvas relative h-[clamp(620px,72vh,900px)] w-full overflow-hidden rounded-xl border bg-canvas transition-colors duration-150 ${dropping ? "border-dutchOrange" : "border-hairline"}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!dropping) setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          const ref = e.dataTransfer.getData(DRAG_TYPE);
          setDropping(false);
          if (!ref) return;
          e.preventDefault();
          const at = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          p.onPlace(ref, { x: Math.round(at.x - 24), y: Math.round(at.y - 20) });
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_, _n, dragged: Node[]) => onDragStop(dragged.map((n) => n.id))}
          onNodeClick={(_, n) => onSelect({ kind: "part", ref: (n as PartNodeType).data.ref })}
          onEdgeClick={(_, e) => {
            const w = wireOfEdge(e);
            if (w) onSelect({ kind: "wire", id: w.item.id });
          }}
          onEdgeDoubleClick={(_, e) => {
            const w = wireOfEdge(e);
            if (w && wireById.has(w.item.id)) onEditWire(w);
          }}
          onPaneClick={() => onSelect(null)}
          onConnect={handleConnect}
          isValidConnection={isValidConnection}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={{ stroke: "#E05A10", strokeWidth: 2, strokeDasharray: "5 4" }}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
          onInit={(inst) => {
            // Node sizes arrive after the first paint; fit again once they are known.
            window.setTimeout(() => void inst.fitView({ padding: 0.15, maxZoom: 1.1, duration: 300 }), 350);
          }}
          minZoom={0.2}
          maxZoom={2.5}
          snapToGrid
          snapGrid={[4, 4]}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--border-hairline)" />
          <Controls showInteractive={false} className="rounded-md! border! border-hairline! shadow-xs!" />
          <MiniMap
            pannable
            zoomable
            className="rounded-md! border! border-hairline! bg-subtle!"
            nodeColor="var(--border-hairline)"
            nodeStrokeColor="var(--text-muted)"
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(113, 113, 122, 0.16)"
          />
          <Panel position="top-left" className="m-3!">
            <div role="group" aria-label="Show or hide wires by net class" className="flex flex-wrap items-center gap-1 rounded-md border border-hairline bg-surface p-1 shadow-xs">
              {CLASSES.map((c) => {
                const on = !hidden.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => p.onToggleClass(c)}
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${
                      on ? "text-primary hover:bg-subtle" : "text-muted line-through hover:bg-subtle"
                    }`}
                    title={on ? `Hide ${CLASS_LABEL[c].toLowerCase()} wires` : `Show ${CLASS_LABEL[c].toLowerCase()} wires`}
                  >
                    <span aria-hidden className="inline-block h-[3px] w-4 rounded-full" style={{ background: NET_COLOR[c], opacity: on ? 1 : 0.35 }} />
                    {CLASS_LABEL[c]}
                    <span className="font-mono text-[10px] text-muted">{counts.get(c) ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel position="bottom-center" className="mb-3! pointer-events-none">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-[11px] text-muted shadow-xs">
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden /> Drag parts to arrange. Drag from pin to pin to add a wire. Double-click a wire to edit it.
            </p>
          </Panel>
          {p.banner && (
            <Panel position="top-center" className="mt-16!">
              {p.banner}
            </Panel>
          )}
        </ReactFlow>
      </div>
    </SchematicContext.Provider>
  );
}
