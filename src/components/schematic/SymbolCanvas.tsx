"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import { Background, BackgroundVariant, ConnectionLineType, ConnectionMode, Controls, Panel, ReactFlow, type Connection, type Node, type NodeChangeset } from "@xyflow/react";
import { MousePointerClick } from "lucide-react";
import type { XY } from "@/lib/domain";
import { SymbolContext, symbolEdgeTypes, symbolNodeTypes, type FlagNodeType, type SymEdgeType, type SymbolNodeType } from "./SymbolNodes";
import type { SymEdge, SymNode } from "./symbolGraph";
import type { ConnectRequest } from "./SchematicCanvas";
import type { Selection } from "./SidePanel";
import { useFitOnPrint } from "./useFitOnPrint";

type Props = {
  nodes: SymNode[];
  edges: SymEdge[];
  sel: Selection;
  litPins: Set<string>;
  litWires: Set<number>;
  onMove: (moves: Record<string, XY>) => void;
  onDragStop: (ids: string[]) => void;
  onSelect: (s: Selection) => void;
  onConnect: (c: ConnectRequest) => void;
  titleBlock: React.ReactNode;
  /** A viewer only: nothing is dragged or connected, the hint is hidden and a plain wheel scrolls the page (Ctrl or Cmd + wheel zooms). Used by the public welcome page. */
  readOnly?: boolean;
  /** Replaces the canvas height classes. */
  heightClass?: string;
};

const refOfNode = (id: string) => id.slice(2);

/**
 * Fit: room for the hint at the top and the zoom buttons at the left, and never so far out that pin names cannot be
 * read (0.55); a larger drawing is panned. Printing fits the whole sheet (useFitOnPrint).
 */
const FIT = { padding: { top: "56px", left: "56px", right: "24px", bottom: "24px" }, maxZoom: 1.2, minZoom: 0.55 } as const;
const pinOfHandle = (h: string | null) => (h ?? "").replace(/^pin:/, "");

/** The symbol view of the schematic: real symbols, power and ground flags, orthogonal wires, net labels. */
export function SymbolCanvas(p: Props) {
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const { onMove, onDragStop, onSelect, onConnect } = p;
  const anyLit = p.litWires.size > 0 || p.litPins.size > 0;
  useFitOnPrint();

  const nodes = useMemo(
    () =>
      p.nodes.map((n): SymbolNodeType | FlagNodeType =>
        n.type === "symbol"
          ? { id: n.id, type: "symbol", position: n.position, data: n.data, selected: p.sel?.kind === "part" && p.sel.ref === n.data.ref, measured: measured[n.id], width: n.data.width, height: n.data.height }
          : { id: n.id, type: "flag", position: n.position, parentId: n.parentId, data: n.data, draggable: false, selectable: false, measured: measured[n.id] }
      ),
    [p.nodes, p.sel, measured]
  );
  const edges = useMemo(
    () =>
      p.edges.map((e): SymEdgeType => {
        const lit = e.data.wireIds.some((id) => p.litWires.has(id));
        return {
          id: e.id,
          type: "net",
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle,
          selectable: !e.data.flag,
          selected: !e.data.flag && p.sel?.kind === "wire" && e.data.wireIds.includes(p.sel.id),
          zIndex: lit ? 10 : 0,
          data: { ...e.data, lit, dim: anyLit && !lit },
        };
      }),
    [p.edges, p.litWires, p.sel, anyLit]
  );

  const onNodesChange = useCallback(
    (changes: NodeChangeset<SymbolNodeType | FlagNodeType>) => {
      const moves: Record<string, XY> = {};
      const dims: Record<string, { width: number; height: number }> = {};
      for (const c of changes) {
        if (c.type === "position" && c.position && c.id.startsWith("s:")) moves[c.id] = { x: Math.round(c.position.x), y: Math.round(c.position.y) };
        if (c.type === "dimensions" && c.dimensions) dims[c.id] = c.dimensions;
      }
      if (Object.keys(moves).length) onMove(moves);
      if (Object.keys(dims).length) setMeasured((m) => ({ ...m, ...dims }));
    },
    [onMove]
  );

  const ctx = useMemo(() => ({ litPins: p.litPins, onPickPin: (ref: string, pin: string) => onSelect({ kind: "pin", ref, pin }) }), [p.litPins, onSelect]);

  return (
    <SymbolContext.Provider value={ctx}>
      <div className={`schematic-canvas relative w-full overflow-hidden rounded-xl border border-hairline bg-canvas ${p.heightClass ?? "h-[clamp(620px,72vh,900px)]"}`} data-testid="symbol-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={symbolNodeTypes}
          edgeTypes={symbolEdgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_, _n, dragged: Node[]) => onDragStop(dragged.map((n) => n.id).filter((id) => id.startsWith("s:")))}
          onNodeClick={(_, n) => {
            if (n.type === "symbol") onSelect({ kind: "part", ref: refOfNode(n.id) });
          }}
          onEdgeClick={(_, e) => {
            const id = (e as SymEdgeType).data?.wireIds[0];
            if (id && !(e as SymEdgeType).data?.flag) onSelect({ kind: "wire", id });
          }}
          onPaneClick={() => onSelect(null)}
          onConnect={(c: Connection) => {
            if (!c.source.startsWith("s:") || !c.target.startsWith("s:")) return;
            onConnect({ from: refOfNode(c.source), fromPin: pinOfHandle(c.sourceHandle), to: refOfNode(c.target), toPin: pinOfHandle(c.targetHandle) });
          }}
          isValidConnection={(c) => c.source.startsWith("s:") && c.target.startsWith("s:") && !(c.source === c.target && c.sourceHandle === c.targetHandle)}
          connectionMode={ConnectionMode.Loose}
          connectOnClick={false}
          connectionLineType={ConnectionLineType.Step}
          connectionLineStyle={{ stroke: "#E05A10", strokeWidth: 2, strokeDasharray: "5 4" }}
          deleteKeyCode={null}
          fitView
          fitViewOptions={FIT}
          onInit={(inst) => window.setTimeout(() => void inst.fitView({ ...FIT, duration: 300 }), 350)}
          minZoom={0.15}
          maxZoom={3}
          snapToGrid
          snapGrid={[10, 10]}
          {...(p.readOnly ? { nodesDraggable: false, nodesConnectable: false, zoomOnScroll: false, preventScrolling: false } : {})}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20.32} size={1.1} color="var(--border-hairline)" />
          <Controls showInteractive={false} className="schematic-noprint rounded-md! border! border-hairline! shadow-xs!" />
          {!p.readOnly && <Panel position="top-left" className="schematic-noprint m-3! pointer-events-none">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-[11px] text-muted shadow-xs">
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden /> Press a pin or a wire to light it up in both views. Drag pin to pin to add a wire.
            </p>
          </Panel>}
        </ReactFlow>
      </div>
      {/* the title block sits under the canvas, never over the drawing */}
      {p.titleBlock ? <div className="mt-2 flex justify-end">{p.titleBlock}</div> : null}
    </SymbolContext.Provider>
  );
}
