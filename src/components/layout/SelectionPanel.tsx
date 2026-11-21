"use client";

import Link from "next/link";
import { ArrowDownToLine, Box as BoxIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import { totalExtent, type PartGeometry } from "../three/layout";
import { NumField } from "./NumField";
import { BASIS_TEXT, round3, type Draft } from "./geom";
import { NativeSelect } from "@/components/ui/native-select";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

export function BasisPicker({ value, onChange, name }: { value: "doc" | "typical" | ""; onChange: (b: "doc" | "typical") => void; name: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs text-muted">Where the size comes from</legend>
      {(["doc", "typical"] as const).map((b) => (
        <label key={b} className="flex cursor-pointer items-start gap-2 text-sm text-primary">
          <input
            type="radio"
            name={name}
            checked={value === b}
            onChange={() => onChange(b)}
            className="mt-1 accent-[#E05A10]"
          />
          <span>{BASIS_TEXT[b]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function SelectionPanel({
  item, geometry, draft, floor, centre, onGeometry, onDraft, onCancelDraft, onClose,
}: {
  item: Item;
  geometry: PartGeometry | null;
  draft: Draft | null;
  /** y of the floor surface a part rests on */
  floor: number;
  /** centre of the enclosure in x and z, or 0, 0 */
  centre: [number, number];
  onGeometry: (g: PartGeometry) => void;
  onDraft: (patch: Partial<Draft>) => void;
  onCancelDraft: () => void;
  onClose: () => void;
}) {
  const d = item.data ?? {};
  const ref = typeof d.ref === "string" ? d.ref : "";

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={eyebrow}>{ref || "No reference"}</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-primary">{item.title}</h3>
        {item.body && <p className="mt-1 text-sm text-secondary">{item.body}</p>}
        {item.status && (
          <div className="mt-2">
            <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close part details" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  const links = (
    <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
      <Link href="/s/design/model" className="text-sm text-link hover:underline">Open in 3D</Link>
      <span className="text-muted" aria-hidden>·</span>
      <Link href="/s/design/schematic" className="text-sm text-link hover:underline">Open in schematic</Link>
    </div>
  );

  if (!geometry) {
    const dd = draft ?? { size: [null, null, null], basis: "" as const, x: 0, y: null, z: 0 };
    const setSize = (i: number, n: number) => onDraft({ size: dd.size.map((v, k) => (k === i ? n : v)) });
    const missing: string[] = [];
    if (dd.size.some((s) => s === null)) missing.push("all three sizes");
    if (!dd.basis) missing.push("where the size comes from");
    return (
      <div className="flex flex-col gap-4">
        {header}
        {!draft ? (
          <p className="text-sm text-secondary">This part has no geometry yet. Use Place in the parts tray, or drag it onto the Top view.</p>
        ) : (
          <>
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              Not saved yet. Enter {missing.length ? missing.join(" and ") : "nothing more"} and it is saved as a box.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Width x" value={dd.size[0]} positive placeholder="mm" onCommit={(n) => setSize(0, n)} />
              <NumField label="Height y" value={dd.size[1]} positive placeholder="mm" onCommit={(n) => setSize(1, n)} />
              <NumField label="Depth z" value={dd.size[2]} positive placeholder="mm" onCommit={(n) => setSize(2, n)} />
            </div>
            <BasisPicker name={`basis-${item.id}`} value={dd.basis} onChange={(b) => onDraft({ basis: b })} />
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Pos x" value={dd.x} onCommit={(n) => onDraft({ x: n })} />
              <NumField label="Pos y" value={dd.y} placeholder="on floor" onCommit={(n) => onDraft({ y: n })} />
              <NumField label="Pos z" value={dd.z} onCommit={(n) => onDraft({ z: n })} />
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={onCancelDraft}>Cancel placing</Button>
            </div>
          </>
        )}
        {links}
      </div>
    );
  }

  const g = geometry;
  const cyl = g.shape === "cylinder";
  const ext = totalExtent(g);
  const set = (change: Partial<PartGeometry>) => onGeometry({ ...g, ...change });
  const setPos = (i: number, n: number) => set({ pos: g.pos.map((v, k) => (k === i ? round3(n) : v)) });
  const setSize = (i: number, n: number) => set({ size: g.size.map((v, k) => (k === i ? n : v)) });
  const setRotation = (i: number, n: number) => {
    const r: [number, number, number] = [g.rotation?.[0] ?? 0, g.rotation?.[1] ?? 0, g.rotation?.[2] ?? 0];
    r[i] = round3(n);
    const next: PartGeometry = { ...g };
    if (r.some((a) => a !== 0)) next.rotation = r;
    else delete next.rotation;
    onGeometry(next);
  };

  const changeShape = (shape: "box" | "cylinder") => {
    if (shape === g.shape) return;
    if (shape === "cylinder") {
      const next: PartGeometry = { ...g, shape, size: [g.size[0], g.size[1]] };
      delete next.axis;
      onGeometry(next);
    } else {
      const e = ext;
      const one = [e[0] / (g.count && g.count > 1 ? g.count : 1), e[1], e[2]];
      const next: PartGeometry = { ...g, shape, size: g.count && g.count > 1 ? one : e };
      delete next.axis;
      onGeometry(next);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Shape</span>
          {g.shape === "shell" ? (
            <p className="flex h-8 items-center font-mono text-xs text-primary">shell</p>
          ) : (
            <NativeSelect className="h-8 text-xs" value={g.shape} onChange={(e) => changeShape(e.target.value as "box" | "cylinder")}>
              <option value="box">box</option>
              <option value="cylinder">cylinder</option>
            </NativeSelect>
          )}
        </label>
        {cyl ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Length runs along</span>
            <NativeSelect
              className="h-8 text-xs"
              value={g.axis ?? ""}
              onChange={(e) => {
                const next: PartGeometry = { ...g };
                if (e.target.value) next.axis = e.target.value as "x" | "y" | "z";
                else delete next.axis;
                onGeometry(next);
              }}
            >
              <option value="">Automatic</option>
              <option value="x">x (width)</option>
              <option value="y">y (up)</option>
              <option value="z">z (depth)</option>
            </NativeSelect>
          </label>
        ) : (
          <NumField label="Count" unit="bodies" value={g.count ?? 1} integer min={1} onCommit={(n) => {
            const next: PartGeometry = { ...g };
            if (n > 1) next.count = n;
            else delete next.count;
            onGeometry(next);
          }} />
        )}
      </div>

      {cyl ? (
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Diameter" value={g.size[0]} positive onCommit={(n) => setSize(0, n)} />
          <NumField label="Length" value={g.size[1]} positive onCommit={(n) => setSize(1, n)} />
          <NumField label="Count" unit="bodies" value={g.count ?? 1} integer min={1} onCommit={(n) => {
            const next: PartGeometry = { ...g };
            if (n > 1) next.count = n;
            else delete next.count;
            onGeometry(next);
          }} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Width x" value={g.size[0]} positive onCommit={(n) => setSize(0, n)} />
          <NumField label="Height y" value={g.size[1]} positive onCommit={(n) => setSize(1, n)} />
          <NumField label="Depth z" value={g.size[2]} positive onCommit={(n) => setSize(2, n)} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <NumField label="Pos x" value={g.pos[0]} onCommit={(n) => setPos(0, n)} />
        <NumField label="Pos y" value={g.pos[1]} onCommit={(n) => setPos(1, n)} />
        <NumField label="Pos z" value={g.pos[2]} onCommit={(n) => setPos(2, n)} />
      </div>
      <p className="-mt-2 text-xs text-muted">Position is the centre of the part. The origin is the centre of the enclosure floor.</p>

      {g.shape !== "shell" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {["x", "y", "z"].map((a, i) => (
              <NumField key={a} label={`Rotate ${a}`} unit="deg" value={g.rotation?.[i] ?? 0} onCommit={(n) => setRotation(i, n)} />
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted">Degrees about the part&apos;s own centre, turned about x, then y, then z. The footprint shown is the box around the turned part.</p>
        </>
      )}

      {g.shape !== "shell" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPos(1, floor + ext[1] / 2)}>
            <ArrowDownToLine className="h-3.5 w-3.5" /> Rest on floor
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPos(0, centre[0])}>
            <BoxIcon className="h-3.5 w-3.5" /> Centre in X
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPos(2, centre[1])}>
            <BoxIcon className="h-3.5 w-3.5" /> Centre in Z
          </Button>
        </div>
      )}

      <BasisPicker name={`basis-${item.id}`} value={g.basis} onChange={(b) => set({ basis: b })} />

      {links}
    </div>
  );
}
