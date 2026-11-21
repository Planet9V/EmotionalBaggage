"use client";

import { createContext, memo, useContext, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
  useUpdateNodeInternals,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { NET_STROKE, type Wire } from "@/lib/domain";
import { FOOT_H, HEADER_H, NODE_W, ROW_H, handleId, type PinRow } from "./model";

/** What nodes need from the view without carrying it in every node's data. */
export type CanvasCtx = {
  onAddPin: (ref: string) => void;
  /** "REF.PIN" keys to emphasise (hovered net, selected pin or wire) */
  highlight: Set<string>;
  /** select one pin (lights it up in both views) */
  onPickPin?: (ref: string, pin: string) => void;
};
export const SchematicContext = createContext<CanvasCtx>({ onAddPin: () => {}, highlight: new Set() });

export type PartData = { ref: string; title: string; ghost: boolean; pins: PinRow[] };
export type PartNodeType = Node<PartData, "part">;
export type WireData = { wire: Wire; label: boolean; dim: boolean; emph: boolean };
export type WireEdgeType = Edge<WireData, "wire">;

const HANDLE = "h-[10px]! w-[10px]! rounded-full! border-2! bg-surface!";

function PartNodeView({ id, data, selected }: NodeProps<PartNodeType>) {
  const { onAddPin, highlight, onPickPin } = useContext(SchematicContext);
  const update = useUpdateNodeInternals();
  const sides = data.pins.map((p) => `${p.name}:${p.side}`).join("|");
  // handles move when a pin changes side or a pin is added; React Flow has to re-measure them
  useEffect(() => {
    update(id);
  }, [id, sides, update]);

  const ring = selected
    ? "border-dutchOrange shadow-[0_0_20px_rgba(224,90,16,0.15)]"
    : data.ghost
      ? "border-dashed border-danger"
      : "border-hairline hover:border-dutchOrange/40";
  return (
    <div className={`rounded-xl border bg-surface text-left shadow-xs transition-[border-color,box-shadow] duration-150 ${ring}`} style={{ width: NODE_W }}>
      <div className="flex flex-col justify-center border-b border-hairline px-3" style={{ height: HEADER_H }}>
        <span className="font-mono text-[11px] font-semibold leading-tight text-link">{data.ref}</span>
        <span className={`truncate text-[12px] leading-snug ${data.ghost ? "text-danger" : "text-primary"}`} title={data.title}>
          {data.title}
        </span>
      </div>
      {data.pins.map((p) => {
        const left = p.side === "left";
        const lit = highlight.has(`${data.ref}.${p.name}`);
        const color = p.netClass ? NET_STROKE[p.netClass] : "var(--text-muted)";
        return (
          <div
            key={p.name}
            className={`relative flex items-center px-3 font-mono text-[11px] ${left ? "justify-start" : "justify-end"} ${
              lit ? "bg-dutchOrange/10 text-primary" : p.wired ? "text-secondary" : "text-muted"
            }`}
            style={{ height: ROW_H }}
          >
            <span
              className="nodrag cursor-pointer truncate"
              title={p.wired ? p.name : `${p.name} (no wire)`}
              onClick={(e) => {
                e.stopPropagation();
                onPickPin?.(data.ref, p.name);
              }}
            >
              {p.name}
              {!p.wired && <span className="ml-1 text-[9px] uppercase tracking-[0.15em] text-warning">open</span>}
            </span>
            <Handle
              type="source"
              id={handleId(p.name)}
              position={left ? Position.Left : Position.Right}
              className={HANDLE}
              style={{ borderColor: color }}
              role="button"
              aria-label={`Pin ${data.ref}.${p.name}. Drag to another pin to add a wire.`}
            />
          </div>
        );
      })}
      <div className="flex items-center border-t border-hairline px-2" style={{ height: FOOT_H }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddPin(data.ref);
          }}
          className="nodrag inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
        >
          <Plus className="h-3 w-3" aria-hidden /> Add pin
        </button>
      </div>
    </div>
  );
}

function WireEdgeView(props: EdgeProps<WireEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data } = props;
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 6, offset: 20 });
  if (!data) return null;
  const color = NET_STROKE[data.wire.netClass];
  const width = selected ? 3.5 : data.emph ? 3 : 1.75;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={16}
        style={{
          stroke: color,
          strokeWidth: width,
          opacity: data.dim ? 0.18 : 1,
          filter: selected ? "drop-shadow(0 0 4px rgba(224,90,16,0.75))" : undefined,
          transition: "stroke-width 150ms ease-out, opacity 150ms ease-out",
        }}
      />
      {data.label && data.wire.net && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-sm border border-hairline bg-surface px-1 font-mono text-[9px] leading-[14px] text-secondary"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, opacity: data.dim ? 0.25 : 1, borderColor: selected ? "#E05A10" : undefined }}
          >
            <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} />
            {data.wire.net}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const nodeTypes = { part: memo(PartNodeView) };
export const edgeTypes = { wire: memo(WireEdgeView) };
