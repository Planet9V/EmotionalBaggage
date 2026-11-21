"use client";

/** Side panel for the selected part: what it is, its size and where that size comes from, and a geometry editor. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Part } from "@/lib/domain";
import type { ShapeStatus } from "@/lib/geometry/useShapes";
import { ShapeFileSection } from "./ShapeFileSection";
import { bodyExtent, describeSize, fmt, type PartGeometry } from "./layout";
import { NativeSelect } from "@/components/ui/native-select";
import { basisText } from "@/lib/domain/part";


/** One wire touching the focused part. */
export type ConnectionRow = {
  key: number;
  /** pin on the focused part */
  pin: string;
  otherRef: string;
  otherPin: string;
  otherTitle: string;
  /** part to focus when the row is clicked; null when the other end has no part or no geometry */
  otherId: number | null;
  net: string;
  color: string;
  status: string;
};

export type FocusControls = {
  focused: boolean;
  sub: boolean;
  /** why Focus is unavailable, "" when it is available */
  reason: string;
  onFocus: () => void;
  onExit: () => void;
  onToggleSub: (v: boolean) => void;
  connections: ConnectionRow[];
  onOpenPart: (id: number) => void;
};

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono text-xs leading-5 text-primary" : "text-primary"}>{children}</dd>
    </div>
  );
}

export function PartPanel({ part, projectId, shapeStatus, onClose, onSave, onTogglePrint, focus }: {
  part: Part;
  projectId: string;
  shapeStatus?: ShapeStatus;
  onClose: () => void;
  onSave: (g: PartGeometry) => Promise<void>;
  onTogglePrint: (v: boolean) => void;
  focus?: FocusControls;
}) {
  const g = part.geometry;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={eyebrow}>{part.ref || "No reference"}</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-primary">{part.item.title}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close part details" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {focus && (
            <Button
              size="sm"
              variant={focus.focused ? "subtle" : "primary"}
              onClick={focus.focused ? focus.onExit : focus.onFocus}
              disabled={!focus.focused && focus.reason !== ""}
            >
              <Crosshair className="h-3.5 w-3.5" /> {focus.focused ? "Back to whole product" : "Focus"}
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/s/design/schematic">Open in schematic</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/s/design/layout">Open in layout</Link>
          </Button>
        </div>
        {focus && !focus.focused && focus.reason && <p className="text-[11px] text-muted">{focus.reason}</p>}
        {focus?.focused && (
          <label className="inline-flex items-center gap-2 text-xs text-secondary">
            <input type="checkbox" className="h-4 w-4 accent-[#E05A10]" checked={focus.sub} onChange={(e) => focus.onToggleSub(e.target.checked)} />
            Sub-assembly: include everything wired to this part
          </label>
        )}
      </div>
      <dl className="divide-y divide-(--border-hairline)">
        <Row label="Spec">{part.item.body ? <span className="whitespace-pre-wrap">{part.item.body}</span> : <span className="text-muted">None written</span>}</Row>
        <Row label="Qty" mono>{part.qty === null ? <span className="font-sans text-muted">Not set</span> : fmt(part.qty)}</Row>
        <Row label="Source">{part.source || <span className="text-muted">Not set</span>}</Row>
        <Row label="Line cost" mono>{part.line === null ? <span className="font-sans text-muted">Not set</span> : part.line.toFixed(2)}</Row>
        <Row label="Status">{part.item.status ? <StatusBadge tone={statusTone(part.item.status)}>{part.item.status}</StatusBadge> : <span className="text-muted">None</span>}</Row>
        {g ? (
          <>
            <Row label="Size" mono>
              {describeSize(g)}
              {(g.count ?? 1) > 1 ? ` (${g.count} bodies)` : ""}
              {g.shape === "shell" ? <span className="block font-sans text-xs text-muted">Outer envelope of the enclosure</span> : null}
            </Row>
            <Row label="Turned" mono>
              {g.rotation ? `${g.rotation.map(fmt).join(", ")} deg about x, y, z` : <span className="font-sans text-muted">Not turned</span>}
            </Row>
            <Row label="Basis">{basisText(g)}</Row>
            <Row label="Printed">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#E05A10]" checked={g.print === true} onChange={(e) => onTogglePrint(e.target.checked)} />
                {g.print ? "3D printed part" : "Bought or made elsewhere"}
              </label>
            </Row>
          </>
        ) : (
          <Row label="Size">
            <span className="text-muted">No geometry yet. Add it below to place this part in the model.</span>
          </Row>
        )}
      </dl>
      {focus?.focused && <Connections rows={focus.connections} hasRef={part.ref !== ""} onOpenPart={focus.onOpenPart} />}
      <GeometryEditor key={`${part.item.id}:${JSON.stringify(g)}`} geometry={g} onSave={onSave} />
      {(g === null || g.shape !== "shell") && <ShapeFileSection projectId={projectId} partRef={part.ref} geometry={g} status={shapeStatus} onSave={onSave} />}
    </div>
  );
}

function Connections({ rows, hasRef, onOpenPart }: { rows: ConnectionRow[]; hasRef: boolean; onOpenPart: (id: number) => void }) {
  return (
    <section aria-label="Connections">
      <div className="flex items-baseline justify-between">
        <p className={eyebrow}>Connections</p>
        <span className="font-mono text-[10px] text-muted">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{hasRef ? "No wire touches this part yet." : "This part has no reference, so wires cannot point at it. Set one in the bill of materials."}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {rows.map((r) => {
            const body = (
              <>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="truncate font-mono text-[11px] text-primary">
                    {`${r.pin || "pin ?"} \u2192 ${r.otherRef}${r.otherPin ? `.${r.otherPin}` : ""}`}
                  </span>
                </span>
                <span className="block truncate text-xs text-secondary">{r.otherTitle}</span>
                <span className="block truncate font-mono text-[10px] text-muted">
                  {r.net || "no net"}
                  {r.status ? ` \u00b7 ${r.status}` : ""}
                </span>
              </>
            );
            const cls = "w-full rounded-md border border-hairline px-2 py-1.5 text-left transition-colors duration-150";
            return (
              <li key={r.key}>
                {r.otherId !== null ? (
                  <button type="button" className={`${cls} hover:border-dutchOrange/40 hover:bg-subtle`} onClick={() => onOpenPart(r.otherId as number)} aria-label={`Focus ${r.otherRef} ${r.otherTitle}`}>
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Form = {
  shape: PartGeometry["shape"];
  size: string[];
  axis: "" | "x" | "y" | "z";
  pos: string[];
  rot: string[];
  explode: string[];
  count: string;
  basis: "" | PartGeometry["basis"];
  print: boolean;
};

const toForm = (g: PartGeometry | null): Form =>
  g
    ? {
        shape: g.shape,
        size: [0, 1, 2].map((i) => (g.size[i] === undefined ? "" : String(g.size[i]))),
        axis: g.axis ?? "",
        pos: g.pos.map(String),
        rot: (g.rotation ?? [0, 0, 0]).map(String),
        explode: g.explode.map(String),
        count: String(g.count ?? 1),
        basis: g.basis,
        print: g.print === true,
      }
    : { shape: "box", size: ["", "", ""], axis: "", pos: ["0", "", "0"], rot: ["0", "0", "0"], explode: ["0", "0", "0"], count: "1", basis: "", print: false };

function fromForm(f: Form, base: PartGeometry | null): { geometry: PartGeometry | null; problem: string } {
  const n = f.shape === "cylinder" ? 2 : 3;
  const size = f.size.slice(0, n).map((s) => Number(s));
  if (f.size.slice(0, n).some((s) => s.trim() === "") || size.some((s) => !Number.isFinite(s) || s <= 0)) return { geometry: null, problem: "Every size must be a number above 0." };
  if (!f.basis) return { geometry: null, problem: "Say where the size comes from." };
  const count = f.count.trim() === "" ? 1 : Math.round(Number(f.count));
  if (!Number.isFinite(count) || count < 1 || count > 200) return { geometry: null, problem: "Count must be a whole number from 1 to 200." };
  const draft: PartGeometry = { shape: f.shape, size, pos: [0, 0, 0], explode: [0, 0, 0], basis: f.basis };
  if (f.shape === "cylinder" && f.axis) draft.axis = f.axis;
  const height = bodyExtent(draft)[1];
  const pos = f.pos.map((s, i) => (s.trim() === "" ? (i === 1 ? height / 2 : 0) : Number(s)));
  const explode = f.explode.map((s) => (s.trim() === "" ? 0 : Number(s)));
  if ([...pos, ...explode].some((v) => !Number.isFinite(v))) return { geometry: null, problem: "Position and explode offsets must be numbers." };
  const rot = f.rot.map((s) => (s.trim() === "" ? 0 : Number(s)));
  if (rot.some((v) => !Number.isFinite(v) || Math.abs(v) > 3600)) return { geometry: null, problem: "Rotation must be degrees, as numbers." };
  if (f.shape === "shell" && rot.some((v) => v !== 0)) return { geometry: null, problem: "An enclosure shell cannot be rotated. Rotate the parts inside it." };
  const out: PartGeometry = { ...draft, pos, explode };
  if (rot.some((v) => v !== 0)) out.rotation = [rot[0], rot[1], rot[2]];
  // An attached file keeps its box size; the form cannot change what the file is.
  if (base?.file) {
    out.shape = "box";
    out.size = [...base.size];
    out.file = { ...base.file };
    delete out.axis;
    delete out.count;
    return { geometry: { ...out, ...(f.print ? { print: true } : {}) }, problem: "" };
  }
  if (count > 1) out.count = count;
  if (f.print) out.print = true;
  return { geometry: out, problem: "" };
}

const canon = (g: PartGeometry | null) =>
  g ? JSON.stringify([g.shape, g.size, g.pos, g.explode, g.basis, g.count ?? 1, g.print === true, g.shape === "cylinder" ? g.axis ?? "" : "", g.rotation ?? [0, 0, 0], g.file ?? null]) : "";
const same = (a: PartGeometry | null, b: PartGeometry | null) => canon(a) === canon(b);

function NumField({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <Input inputMode="decimal" className="h-8 px-2 font-mono text-xs" value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function GeometryEditor({ geometry, onSave }: { geometry: PartGeometry | null; onSave: (g: PartGeometry) => Promise<void> }) {
  const [open, setOpen] = useState(geometry !== null);
  const [f, setF] = useState<Form>(() => toForm(geometry));
  const [saving, setSaving] = useState(false);
  const result = useMemo(() => fromForm(f, geometry), [f, geometry]);
  const dirty = !same(result.geometry, geometry) || (result.geometry === null && geometry !== null);

  if (!open) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-4">
        <p className="text-sm text-secondary">Give this part a shape and size so it appears in the model.</p>
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Add geometry
        </Button>
      </div>
    );
  }

  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));
  const setAt = (k: "size" | "pos" | "rot" | "explode", i: number, v: string) => setF((x) => ({ ...x, [k]: x[k].map((s, j) => (j === i ? v : s)) }));
  const locked = !!geometry?.file;
  const sizeLabels = f.shape === "cylinder" ? ["Diameter", "Length"] : ["Width x", "Height y", "Depth z"];

  const save = async () => {
    if (!result.geometry) return;
    setSaving(true);
    try {
      await onSave(result.geometry);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-hairline bg-subtle p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center justify-between">
        <p className={eyebrow}>Geometry, mm</p>
        <span className="text-[11px] text-muted">{saving ? "Saving" : dirty ? "Unsaved changes" : geometry ? "Saved" : ""}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Shape</span>
          <NativeSelect className="h-8 text-xs" value={locked ? "box" : f.shape} disabled={locked} onChange={(e) => set({ shape: e.target.value as Form["shape"] })}>
            <option value="box">Box</option>
            <option value="cylinder">Cylinder</option>
            <option value="shell">Enclosure shell</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Size basis</span>
          <NativeSelect className="h-8 text-xs" value={f.basis} onChange={(e) => set({ basis: e.target.value as Form["basis"] })}>
            <option value="">Choose</option>
            <option value="doc">Stated in source documents</option>
            <option value="typical">Typical, not measured</option>
          </NativeSelect>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {sizeLabels.map((l, i) => (
          <NumField key={l} label={l} value={f.size[i]} disabled={locked} onChange={(v) => setAt("size", i, v)} />
        ))}
        {f.shape === "cylinder" && (
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Axis</span>
            <NativeSelect className="h-8 text-xs" value={f.axis} onChange={(e) => set({ axis: e.target.value as Form["axis"] })}>
              <option value="">Auto</option>
              <option value="x">x</option>
              <option value="y">y (upright)</option>
              <option value="z">z</option>
            </NativeSelect>
          </label>
        )}
      </div>
      {f.shape === "cylinder" && !f.axis && (
        <p className="text-[11px] text-muted">Auto stands a cylinder upright when it is shorter than it is wide, otherwise lays it along z.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {["x", "y", "z"].map((a, i) => (
          <NumField key={a} label={`Centre ${a}`} value={f.pos[i]} placeholder={i === 1 ? "on floor" : "0"} onChange={(v) => setAt("pos", i, v)} />
        ))}
      </div>
      {f.shape !== "shell" && (
        <div className="grid grid-cols-3 gap-2">
          {["x", "y", "z"].map((a, i) => (
            <NumField key={a} label={`Rotate ${a}, deg`} value={f.rot[i]} placeholder="0" onChange={(v) => setAt("rot", i, v)} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {["x", "y", "z"].map((a, i) => (
          <NumField key={a} label={`Explode ${a}`} value={f.explode[i]} placeholder="0" onChange={(v) => setAt("explode", i, v)} />
        ))}
      </div>
      <div className="grid grid-cols-3 items-end gap-2">
        <NumField label="Count" value={f.count} onChange={(v) => set({ count: v })} />
        <label className="col-span-2 flex h-8 items-center gap-2 text-xs text-secondary">
          <input type="checkbox" className="h-4 w-4 accent-[#E05A10]" checked={f.print} onChange={(e) => set({ print: e.target.checked })} />
          3D printed part
        </label>
      </div>
      <p className="text-[11px] leading-4 text-muted">Origin is the centre of the enclosure floor; y is up. A blank centre y rests the part on the floor. Rotation turns the part about its own centre, about x, then y, then z.{locked ? " The shape comes from the attached file, so its size cannot be edited here." : ""}</p>
      {result.problem && <p className="text-xs text-warning">{result.problem}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!result.geometry || !dirty || saving}>
          {geometry ? "Save geometry" : "Add to model"}
        </Button>
        {dirty && geometry && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setF(toForm(geometry))}>
            Undo changes
          </Button>
        )}
      </div>
    </form>
  );
}
