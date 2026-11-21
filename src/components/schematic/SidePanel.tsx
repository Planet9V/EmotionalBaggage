"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Box, LayoutGrid, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Wire } from "@/lib/domain";
import { WIRE_STATUSES, pinKey, pinLabel, type Graph, type NetInfo, type Part } from "./model";
import { EYEBROW, NetSwatch, Select } from "./controls";

export type Selection = { kind: "wire"; id: number } | { kind: "part"; ref: string } | null;

type Props = {
  sel: Selection;
  graph: Graph;
  parts: Part[];
  wires: Wire[];
  nets: NetInfo[];
  statuses: string[];
  hoverNet: string | null;
  onHoverNet: (net: string | null) => void;
  onSelect: (s: Selection) => void;
  onEditWire: (w: Wire) => void;
  onPatchWire: (w: Wire, change: { status?: string; order?: number }) => void;
  onRemovePin: (p: Part, pin: string) => void;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-baseline gap-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-sm text-primary">{children}</dd>
    </div>
  );
}

function OrderInput({ wire, onCommit }: { wire: Wire; onCommit: (n: number) => void }) {
  const [v, setV] = useState(String(wire.order));
  const commit = () => {
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n) && n !== wire.order) onCommit(n);
    else setV(String(wire.order));
  };
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      inputMode="numeric"
      aria-label="Soldering order"
      className="h-8 w-20 font-mono"
    />
  );
}

export function SidePanel(p: Props) {
  const { sel } = p;
  if (sel?.kind === "wire") {
    const w = p.wires.find((x) => x.item.id === sel.id);
    if (w) return <WirePanel {...p} wire={w} />;
  }
  if (sel?.kind === "part") {
    const onCanvas = p.graph.nodes.some((n) => n.kind === "part" && n.ref === sel.ref);
    if (onCanvas || p.parts.some((x) => x.ref === sel.ref)) return <PartPanel {...p} refName={sel.ref} />;
  }
  return <NetList {...p} />;
}

function Header({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={EYEBROW}>{eyebrow}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug tracking-tight text-primary">{title}</h3>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Clear selection" className="rounded-md p-1 text-muted transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function WirePanel({ wire: w, parts, statuses, onSelect, onEditWire, onPatchWire }: Props & { wire: Wire }) {
  const list = statuses.length ? statuses : WIRE_STATUSES;
  const statusList = w.status && !list.includes(w.status) ? [...list, w.status] : list;
  const title = (ref: string) => parts.find((x) => x.ref === ref)?.title;
  const end = (ref: string, pin: string) => (
    <button type="button" onClick={() => onSelect({ kind: "part", ref })} className="font-mono text-link hover:underline" title={title(ref) ?? "Not in the bill of materials"}>
      {pinKey(ref, pin)}
    </button>
  );
  return (
    <div className="space-y-3">
      <Header eyebrow={`Wire ${w.order}`} title={w.name} onClose={() => onSelect(null)} />
      <dl className="divide-y divide-hairline">
        <Row label="Net">
          <span className="font-mono">{w.net || "none"}</span>
          <span className="ml-2 text-xs text-secondary">
            <NetSwatch netClass={w.netClass} />
          </span>
        </Row>
        <Row label="Route">
          <span className="inline-flex flex-wrap items-center gap-1">
            {end(w.from, w.fromPin)}
            <ArrowRight className="h-3 w-3 text-muted" aria-hidden />
            {w.via && (
              <>
                <button type="button" onClick={() => onSelect({ kind: "part", ref: w.via })} className="font-mono text-link hover:underline">
                  {w.via}
                </button>
                <ArrowRight className="h-3 w-3 text-muted" aria-hidden />
              </>
            )}
            {end(w.to, w.toPin)}
          </span>
        </Row>
        <Row label="Via">{w.via ? `${w.via}${title(w.via) ? ` · ${title(w.via)}` : " · not in the bill of materials"}` : "None"}</Row>
        <Row label="Note">{w.note ? <span className="text-secondary">{w.note}</span> : <span className="text-muted">None</span>}</Row>
        <Row label="Status">
          <span className="flex items-center gap-2">
            <Select value={w.status} onChange={(e) => onPatchWire(w, { status: e.target.value })} className="h-8 w-36 text-xs" aria-label="Wire status">
              {statusList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <StatusBadge tone={statusTone(w.status)}>{w.status || "none"}</StatusBadge>
          </span>
        </Row>
        <Row label="Order">
          <OrderInput key={`${w.item.id}:${w.order}`} wire={w} onCommit={(n) => onPatchWire(w, { order: n })} />
        </Row>
      </dl>
      <Button variant="outline" size="sm" onClick={() => onEditWire(w)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit or delete
      </Button>
    </div>
  );
}

function PartPanel({ refName, parts, wires, graph, onSelect, onRemovePin }: Props & { refName: string }) {
  const part = parts.find((x) => x.ref === refName) ?? null;
  const node = graph.nodes.find((n) => n.kind === "part" && n.ref === refName);
  const pins = node && node.kind === "part" ? node.pins : [];
  const series = wires.filter((w) => w.via === refName);
  return (
    <div className="space-y-3">
      <Header eyebrow={refName} title={part ? part.title : "Not in the bill of materials"} onClose={() => onSelect(null)} />
      {part ? (
        part.spec && <p className="text-sm text-secondary">{part.spec}</p>
      ) : (
        <p className="text-sm text-secondary">
          Wires name {refName}, but no part in the{" "}
          <Link href="/s/design/bom" className="text-link hover:underline">
            bill of materials
          </Link>{" "}
          has that ref. Add it there or edit the wires.
        </p>
      )}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Pins</p>
        <ul className="mt-1 divide-y divide-hairline">
          {pins.map((pin) => {
            const on = wires.filter((w) => (w.from === refName && pinLabel(w.fromPin) === pin.name) || (w.to === refName && pinLabel(w.toPin) === pin.name));
            return (
              <li key={pin.name} className="py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-primary">{pin.name}</span>
                  {!on.length && part && pin.extra && (
                    <button type="button" onClick={() => onRemovePin(part, pin.name)} className="text-[11px] text-muted transition-colors duration-150 hover:text-danger">
                      Remove pin
                    </button>
                  )}
                </div>
                {on.length ? (
                  <ul className="mt-0.5 space-y-0.5">
                    {on.map((w) => {
                      const other = w.from === refName && pinLabel(w.fromPin) === pin.name ? pinKey(w.to, w.toPin) : pinKey(w.from, w.fromPin);
                      return (
                        <li key={w.item.id}>
                          <button type="button" onClick={() => onSelect({ kind: "wire", id: w.item.id })} className="text-left text-xs text-secondary hover:text-link">
                            to <span className="font-mono">{other}</span>
                            {w.via && <> through {w.via}</>}
                            {w.net && <span className="text-muted"> · {w.net}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-warning">No wire yet. Drag from this pin on the canvas.</p>
                )}
              </li>
            );
          })}
        </ul>
        {!pins.length && (
          <p className="mt-1 text-xs text-muted">
            {series.length ? "No named pins. It is drawn inline on the wires it sits in." : "No named pins. Use Place in the parts row above the canvas to give it one."}
          </p>
        )}
        {series.length > 0 && (
          <p className="mt-2 text-xs text-secondary">
            In series on {series.map((w) => `wire ${w.order}`).join(", ")}.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link href="/s/design/model">
            <Box className="h-3.5 w-3.5" aria-hidden /> 3D model
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/s/design/layout">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Physical layout
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NetList({ nets, wires, hoverNet, onHoverNet }: Props) {
  return (
    <div className="space-y-3">
      <Header eyebrow="Nets" title={nets.length ? `${nets.length} ${nets.length === 1 ? "net" : "nets"} on ${wires.length} ${wires.length === 1 ? "wire" : "wires"}` : "No nets yet"} />
      <p className="text-xs text-muted">Point at a net to light it up on the canvas. Click a wire or a part for its details.</p>
      <ul className="space-y-1.5" onMouseLeave={() => onHoverNet(null)}>
        {nets.map((n) => (
          <li key={n.name}>
            <button
              type="button"
              onMouseEnter={() => onHoverNet(n.name)}
              onFocus={() => onHoverNet(n.name)}
              onBlur={() => onHoverNet(null)}
              className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors duration-150 ${
                hoverNet === n.name ? "border-dutchOrange/40 bg-dutchOrange/10" : "border-hairline hover:border-dutchOrange/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{n.name}</span>
                <span className="font-mono text-[10px] text-muted">
                  {n.wires.length} {n.wires.length === 1 ? "wire" : "wires"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-secondary">
                {n.classes.map((c) => (
                  <NetSwatch key={c} netClass={c} />
                ))}
              </div>
              <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-secondary">
                {n.members.join("  ")}
                {n.vias.map((v) => (
                  <span key={v.wire.item.id} className="text-muted">
                    {"  "}through {v.via}
                  </span>
                ))}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
