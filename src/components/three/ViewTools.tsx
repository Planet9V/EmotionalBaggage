"use client";

/** Controls around the 3D canvas: handles, section cut, measuring, export, wire routing, and the parts table. */
import { useState } from "react";
import { Download, Hand, Move3d, Rotate3d, Route, Ruler, Scissors, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RouteOutcome } from "@/lib/geometry/routing";
import { fmt } from "./layout";
import type { CutPlane, Measurement, TransformMode } from "./ModelCanvas";
import type { PartGeometry } from "./layout";
import { NativeSelect } from "@/components/ui/native-select";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";
const focusRing = "focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange";

export function EditBar({ mode, onMode, measure, onMeasure, canUndo, canRedo, onUndo, onRedo, selectedLabel, disabled, exploded }: {
  mode: TransformMode;
  onMode: (m: TransformMode) => void;
  measure: boolean;
  onMeasure: (v: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedLabel: string;
  disabled: boolean;
  exploded: boolean;
}) {
  const modes: { key: TransformMode; label: string; icon: React.ReactNode }[] = [
    { key: "off", label: "No handles", icon: <Hand className="h-3.5 w-3.5" aria-hidden /> },
    { key: "translate", label: "Move", icon: <Move3d className="h-3.5 w-3.5" aria-hidden /> },
    { key: "rotate", label: "Rotate", icon: <Rotate3d className="h-3.5 w-3.5" aria-hidden /> },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Edit the model">
      <div className="inline-flex rounded-md border border-hairline bg-surface p-0.5" role="group" aria-label="Handles on the selected part">
        {modes.map((m) => (
          <Button key={m.key} size="sm" variant={mode === m.key && !measure ? "subtle" : "ghost"} className="h-7" aria-pressed={mode === m.key && !measure} disabled={disabled || measure} onClick={() => onMode(m.key)}>
            {m.icon} {m.label}
          </Button>
        ))}
      </div>
      <Button size="sm" variant={measure ? "subtle" : "outline"} className="h-8" aria-pressed={measure} disabled={disabled} onClick={() => onMeasure(!measure)}>
        <Ruler className="h-3.5 w-3.5" aria-hidden /> Measure
      </Button>
      <div className="inline-flex gap-1">
        <Button size="icon-sm" variant="outline" aria-label="Undo the last move (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted" aria-live="polite">
        {measure
          ? "Measuring: click two points on parts."
          : exploded && mode !== "off"
            ? "Handles work in the assembled view. Set the explode slider to 0."
            : selectedLabel
              ? `${selectedLabel} selected. Drag a handle: 1 mm and 15 degree steps.`
              : "Select a part to move or turn it."}
      </p>
    </div>
  );
}

export function MeasureReadout({ m, onClear }: { m: Measurement; onClear: () => void }) {
  if (!m) return null;
  const d = [0, 1, 2].map((k) => Math.abs(m.a[k] - m.b[k]));
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs text-primary">
      <span className="font-mono">
        Distance <strong className="font-semibold">{m.distance.toFixed(2)} mm</strong>
      </span>
      <span className="font-mono text-secondary">
        dx {d[0].toFixed(2)} · dy {d[1].toFixed(2)} · dz {d[2].toFixed(2)}
      </span>
      <Button size="chip" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </p>
  );
}

const AXES = ["x", "y", "z"] as const;

export function SectionPanel({ cut, bounds, onChange }: { cut: CutPlane[]; bounds: { min: number[]; max: number[] }; onChange: (c: CutPlane[]) => void }) {
  const [open, setOpen] = useState(false);
  const active = cut.filter((c) => c.on).length;
  const set = (i: number, patch: Partial<CutPlane>) => onChange(cut.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="rounded-md border border-hairline bg-surface">
      <button type="button" className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs text-primary ${focusRing}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="inline-flex items-center gap-2">
          <Scissors className="h-3.5 w-3.5" aria-hidden /> Section cut
          <span className="font-mono text-[10px] text-muted">{active ? `${active} plane${active === 1 ? "" : "s"} on` : "off"}</span>
        </span>
        <span className="font-mono text-[10px] text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-hairline px-3 py-2">
          {AXES.map((ax, i) => {
            const c = cut[i];
            const lo = Math.floor(bounds.min[i]);
            const hi = Math.ceil(bounds.max[i]);
            return (
              <div key={ax} className="grid grid-cols-[96px_minmax(0,1fr)_64px_auto] items-center gap-2 text-xs">
                <label className="inline-flex items-center gap-2 text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#E05A10]"
                    checked={c.on}
                    onChange={(e) => set(i, { on: e.target.checked, pos: c.on ? c.pos : Math.round((lo + hi) / 2) })}
                  />
                  Cut across {ax}
                </label>
                <input
                  type="range"
                  min={lo}
                  max={hi}
                  step={1}
                  value={Math.min(hi, Math.max(lo, c.pos))}
                  disabled={!c.on}
                  aria-label={`Section position along ${ax}, mm`}
                  aria-valuetext={`${c.pos} mm`}
                  onChange={(e) => set(i, { pos: Number(e.target.value) })}
                  className="h-1 accent-[#E05A10] disabled:opacity-40"
                />
                <span className="text-right font-mono text-secondary">{fmt(c.pos)} mm</span>
                <label className="inline-flex items-center gap-1.5 text-secondary">
                  <input type="checkbox" className="h-4 w-4 accent-[#E05A10]" checked={c.flip} disabled={!c.on} onChange={(e) => set(i, { flip: e.target.checked })} />
                  Keep the high side
                </label>
              </div>
            );
          })}
          <p className="text-[11px] text-muted">Each plane hides one side of everything. Solids show their inside; the cut face is not capped.</p>
        </div>
      )}
    </div>
  );
}

export function ExportBar({ selectedLabel, busy, error, onExport }: {
  selectedLabel: string;
  busy: string;
  error: string;
  onExport: (what: "assembly" | "part", format: "stl" | "3mf") => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export the model">
        <span className={eyebrow}>Export</span>
        <Button size="sm" variant="outline" className="h-8" disabled={!!busy} onClick={() => onExport("assembly", "stl")}>
          <Download className="h-3.5 w-3.5" /> Assembly STL
        </Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!!busy} onClick={() => onExport("assembly", "3mf")}>
          <Download className="h-3.5 w-3.5" /> Assembly 3MF
        </Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!!busy || !selectedLabel} onClick={() => onExport("part", "stl")}>
          <Download className="h-3.5 w-3.5" /> {selectedLabel ? `${selectedLabel} STL` : "Part STL"}
        </Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!!busy || !selectedLabel} onClick={() => onExport("part", "3mf")}>
          <Download className="h-3.5 w-3.5" /> {selectedLabel ? `${selectedLabel} 3MF` : "Part 3MF"}
        </Button>
        {busy && <span role="status" className="text-xs text-muted">Writing {busy}.</span>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export type RouteState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; outcome: RouteOutcome; totalMs: number }
  | { state: "error"; message: string };

export const CELLS = [1, 2, 3, 5];

export function RoutePanel({ cell, onCell, onRoute, result, canRoute, why, counts }: {
  cell: number;
  onCell: (c: number) => void;
  onRoute: () => void;
  result: RouteState;
  canRoute: boolean;
  why: string;
  counts: { routed: number; stale: number; total: number };
}) {
  const running = result.state === "running";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-8" disabled={!canRoute || running} onClick={onRoute}>
          <Route className="h-3.5 w-3.5" aria-hidden /> {running ? "Routing" : "Route wires"}
        </Button>
        <label className="inline-flex items-center gap-1.5 text-xs text-secondary">
          Grid cell
          <NativeSelect className="h-8 w-auto text-xs" value={cell} disabled={running} onChange={(e) => onCell(Number(e.target.value))}>
            {CELLS.map((c) => (
              <option key={c} value={c}>
                {c} mm
              </option>
            ))}
          </NativeSelect>
        </label>
        <span className="font-mono text-[10px] text-muted">
          {counts.total === 0 ? "no wires" : `${counts.routed} of ${counts.total} routed${counts.stale ? `, ${counts.stale} out of date` : ""}`}
        </span>
      </div>
      {!canRoute && why && <p className="text-xs text-muted">{why}</p>}
      {result.state === "running" && (
        <p role="status" className="text-xs text-muted">
          Asking the planner to route the wires around the parts. A large enclosure can take several seconds.
        </p>
      )}
      {result.state === "error" && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
          {result.message}
        </p>
      )}
      {result.state === "done" && <RouteSummary outcome={result.outcome} totalMs={result.totalMs} />}
    </div>
  );
}

function RouteSummary({ outcome: o, totalMs }: { outcome: RouteOutcome; totalMs: number }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md border border-hairline bg-surface px-3 py-2 text-xs text-primary">
      <p>
        Routed <strong className="font-semibold">{o.routed}</strong> wire{o.routed === 1 ? "" : "s"} in <strong className="font-semibold">{(o.plannerMs / 1000).toFixed(2)} s</strong> (planner; {(totalMs / 1000).toFixed(2)} s with saving), on {o.cell} mm cells
        {o.cell > o.requestedCell + 1e-6 ? ` (grown from ${o.requestedCell} mm to keep the grid under its size limit)` : ""}, {o.cells.toLocaleString()} cells.
      </p>
      {o.faceEnds > 0 && (
        <p className="text-secondary">
          {o.faceEnds} wire end{o.faceEnds === 1 ? "" : "s"} start at the middle of a part&apos;s face, because that part has no pin position yet. Lengths are routed, but the ends are approximate.
        </p>
      )}
      {o.failed.length > 0 && (
        <ul className="list-disc pl-4 text-warning">
          {o.failed.map((f) => (
            <li key={f.wireId}>
              {f.name} not routed: {f.reasons.join("; ")}
            </li>
          ))}
        </ul>
      )}
      {o.skipped.length > 0 && (
        <ul className="list-disc pl-4 text-secondary">
          {o.skipped.map((f) => (
            <li key={f.wireId}>
              {f.name} skipped: {f.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type TableRow = { id: number; ref: string; title: string; geometry: PartGeometry | null; selected: boolean };

/** The model as a table, for anyone who cannot use the canvas, and for reading exact numbers. */
export function PartsTable({ rows, onSelect }: { rows: TableRow[]; onSelect: (id: number) => void }) {
  const placed = rows.filter((r) => r.geometry);
  return (
    <details className="rounded-md border border-hairline bg-surface">
      <summary className={`cursor-pointer rounded-md px-3 py-1.5 text-xs text-primary ${focusRing}`}>
        Parts as a table <span className="font-mono text-[10px] text-muted">{placed.length} placed</span>
      </summary>
      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Every part with geometry: its size, centre position and rotation, in millimetres and degrees. The origin is the centre of the enclosure floor and y is up.</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="px-3 py-1.5 font-medium">Part</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Shape</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Size, mm</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Centre x, y, z, mm</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Rotation x, y, z, deg</th>
            </tr>
          </thead>
          <tbody>
            {placed.map((r) => {
              const g = r.geometry as PartGeometry;
              return (
                <tr key={r.id} className={r.selected ? "bg-dutchOrange/10" : ""}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <button type="button" aria-pressed={r.selected} className={`rounded text-left text-primary hover:text-link ${focusRing}`} onClick={() => onSelect(r.id)}>
                      {r.ref && <span className="mr-1 font-mono text-link">{r.ref}</span>}
                      {r.title}
                    </button>
                  </th>
                  <td className="px-2 py-1.5 font-mono">{g.file ? `${g.file.format} file` : g.shape}</td>
                  <td className="px-2 py-1.5 font-mono">{g.size.map(fmt).join(" x ")}</td>
                  <td className="px-2 py-1.5 font-mono">{g.pos.map(fmt).join(", ")}</td>
                  <td className="px-2 py-1.5 font-mono">{(g.rotation ?? [0, 0, 0]).map(fmt).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {placed.length === 0 && <p className="px-3 py-2 text-xs text-muted">No part has geometry yet.</p>}
      </div>
    </details>
  );
}
