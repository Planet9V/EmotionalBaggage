"use client";

import { createContext, memo, useContext } from "react";
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getSmoothStepPath, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { NET_STROKE } from "@/lib/domain";
import { flagLayout, type SymPin } from "@/lib/parts/symbols";
import { FLAG_H, FLAG_W, SCALE, symHandle, type FlagData, type SymEdgeData, type SymNodeData } from "./symbolGraph";

/** What the symbol nodes need from the view: which pins and wires are lit, and how to select a pin. */
export type SymbolCtx = { litPins: Set<string>; onPickPin: (ref: string, pin: string) => void };
export const SymbolContext = createContext<SymbolCtx>({ litPins: new Set(), onPickPin: () => {} });

export type SymbolNodeType = Node<SymNodeData, "symbol">;
export type FlagNodeType = Node<FlagData, "flag">;
export type SymEdgeType = Edge<SymEdgeData & { lit: boolean; dim: boolean }, "net">;

const INK = "var(--text-primary)";
const POS: Record<SymPin["toward"], Position> = { right: Position.Left, left: Position.Right, down: Position.Top, up: Position.Bottom };

function SymbolNodeView({ data, selected }: NodeProps<SymbolNodeType>) {
  const { litPins, onPickPin } = useContext(SymbolContext);
  const { layout, origin, width, height } = data;
  const X = (v: number) => origin.x + v * SCALE;
  const Y = (v: number) => origin.y + v * SCALE;
  const box = layout.rect;
  return (
    <div
      className={`relative rounded-md transition-[box-shadow] duration-150 ${selected ? "shadow-[0_0_0_2px_#E05A10]" : ""}`}
      style={{ width, height }}
      role="group"
      aria-label={`${data.ref} ${data.title}`}
    >
      <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
        {box && <rect x={X(box.x1)} y={Y(box.y1)} width={(box.x2 - box.x1) * SCALE} height={(box.y2 - box.y1) * SCALE} fill="var(--bg-surface)" stroke={INK} strokeWidth={1.5} />}
        {layout.strokes.map((s, i) => (
          <polyline key={i} points={s.points.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")} fill={s.fill ? INK : "none"} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {layout.circles.map((c, i) => (
          <circle key={i} cx={X(c.x)} cy={Y(c.y)} r={Math.max(1, c.r * SCALE)} fill={c.fill ? INK : "none"} stroke={INK} strokeWidth={1.5} />
        ))}
        {layout.texts.map((t, i) => (
          <text key={i} x={X(t.x)} y={Y(t.y) + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill={INK}>
            {t.text}
          </text>
        ))}
        {layout.pins.map((p) => {
          const end = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[p.toward];
          const lit = litPins.has(`${data.ref}.${p.name}`);
          const cls = data.pinClass[p.name];
          return (
            <g key={p.name}>
              <line x1={X(p.x)} y1={Y(p.y)} x2={X(p.x + end[0] * p.length)} y2={Y(p.y + end[1] * p.length)} stroke={lit ? "#E05A10" : cls ? NET_STROKE[cls] : INK} strokeWidth={lit ? 3 : 1.5} />
              {box && (
                <text
                  x={X(p.x + end[0] * (p.length + 0.6))}
                  y={Y(p.y + end[1] * (p.length + 0.6)) + (p.side === "top" ? 9 : p.side === "bottom" ? -3 : 3.5)}
                  textAnchor={p.side === "left" ? "start" : p.side === "right" ? "end" : "middle"}
                  fontSize={9.5}
                  fontFamily="var(--font-mono, monospace)"
                  fill={lit ? "#E05A10" : data.pinsWired[p.name] ? INK : "var(--text-muted)"}
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
        <text x={width / 2} y={13} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily="var(--font-mono, monospace)" fill="#E05A10">
          {data.ref}
        </text>
        <text x={width / 2} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
          {data.title.length > 34 ? `${data.title.slice(0, 33)}…` : data.title}
        </text>
      </svg>
      {layout.pins.map((p) => (
        <Handle
          key={p.name}
          type="source"
          id={symHandle(p.name)}
          position={POS[p.toward]}
          className="h-[9px]! w-[9px]! min-w-0! rounded-full! border-2! bg-surface!"
          style={{ left: X(p.x), top: Y(p.y), right: "auto", bottom: "auto", transform: "translate(-50%, -50%)", borderColor: litPins.has(`${data.ref}.${p.name}`) ? "#E05A10" : "var(--text-muted)" }}
          role="button"
              aria-label={`Pin ${data.ref}.${p.name}. Drag to another pin to add a wire, or press to select it.`}
          onClick={(e) => {
            e.stopPropagation();
            onPickPin(data.ref, p.name);
          }}
        />
      ))}
    </div>
  );
}

function FlagNodeView({ data }: NodeProps<FlagNodeType>) {
  const { litPins, onPickPin } = useContext(SymbolContext);
  const lit = litPins.has(`${data.ref}.${data.pin}`);
  const color = lit ? "#E05A10" : data.kind === "ground" ? NET_STROKE.ground : NET_STROKE.power;
  const lay = flagLayout(data.kind);
  const s = 9;
  // the port is at (0,0) of the drawing: top centre for ground, bottom centre for a supply
  const ox = FLAG_W / 2;
  const oy = data.kind === "ground" ? 2 : FLAG_H - 2;
  return (
    <button
      type="button"
      className="nodrag relative block cursor-pointer bg-transparent p-0"
      style={{ width: FLAG_W, height: FLAG_H }}
      onClick={(e) => {
        e.stopPropagation();
        onPickPin(data.ref, data.pin);
      }}
      title={`${data.net} at ${data.ref}.${data.pin}`}
      aria-label={`${data.kind === "ground" ? "Ground" : "Supply"} ${data.net} at ${data.ref}.${data.pin}`}
    >
      <svg width={FLAG_W} height={FLAG_H} className="overflow-visible" aria-hidden>
        {lay.strokes.map((st, i) => (
          <polyline key={i} points={st.points.map(([x, y]) => `${ox + x * s},${oy + y * s}`).join(" ")} fill="none" stroke={color} strokeWidth={lit ? 2.5 : 1.6} strokeLinecap="round" />
        ))}
        <text x={ox} y={data.kind === "ground" ? FLAG_H - 1 : 8} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono, monospace)" fill={color}>
          {data.net}
        </text>
      </svg>
      <Handle type="target" id="f" position={data.kind === "ground" ? Position.Top : Position.Bottom} isConnectable={false} className="h-1! w-1! min-w-0! border-0! opacity-0" style={{ left: ox, top: oy }} />
    </button>
  );
}

/** An SVG path through elk's route, with its label at the middle of the longest straight run. */
function routePath(points: { x: number; y: number }[]): [string, number, number] {
  const d = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  let best = 0, lx = points[0].x, ly = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (len > best) [best, lx, ly] = [len, (a.x + b.x) / 2, (a.y + b.y) / 2];
  }
  return [d, lx, ly];
}

function NetEdgeView(props: EdgeProps<SymEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data } = props;
  if (!data) return null;
  const [path, lx, ly] = data.route ? routePath(data.route) : getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 0, offset: 16 });
  const width = selected || data.lit ? 3 : data.flag ? 1.4 : 1.75;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={14}
        style={{ stroke: data.lit || selected ? "#E05A10" : data.color, strokeWidth: width, opacity: data.dim ? 0.2 : 1, transition: "stroke-width 150ms ease-out, opacity 150ms ease-out" }}
      />
      {data.label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-sm border border-hairline bg-surface px-1 font-mono text-[9px] leading-[14px] text-secondary"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, opacity: data.dim ? 0.25 : 1, borderColor: data.lit || selected ? "#E05A10" : undefined }}
          >
            {data.net}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const symbolNodeTypes = { symbol: memo(SymbolNodeView), flag: memo(FlagNodeView) };
export const symbolEdgeTypes = { net: memo(NetEdgeView) };
