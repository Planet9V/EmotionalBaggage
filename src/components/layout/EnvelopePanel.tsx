"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PartGeometry } from "../three/layout";
import { NumField } from "./NumField";
import { BasisPicker } from "./SelectionPanel";
import { BASIS_TEXT, round3 } from "./geom";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

export function EnvelopePanel({
  shell, label, wall, onWall, onResize, onCreate,
}: {
  shell: PartGeometry | null;
  label: string;
  wall: number;
  onWall: (n: number) => void;
  onResize: (size: number[]) => void;
  onCreate: (size: number[], basis: "doc" | "typical") => Promise<void>;
}) {
  const [size, setSize] = useState<(number | null)[]>([null, null, null]);
  const [basis, setBasis] = useState<"doc" | "typical" | "">("");
  const [busy, setBusy] = useState(false);
  const ready = size.every((s) => s !== null && s > 0) && basis !== "";

  return (
    <section aria-label="Envelope" className="rounded-xl border border-hairline bg-surface p-3">
      <p className={eyebrow}>Envelope</p>
      {shell ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-secondary">
            <span className="font-mono text-xs text-link">{label}</span> is the outer size of the enclosure. Changing it keeps the bottom where it is.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["Width x", "Height y", "Depth z"] as const).map((l, i) => (
              <NumField key={l} label={l} value={shell.size[i]} positive onCommit={(n) => onResize(shell.size.map((v, k) => (k === i ? round3(n) : v)))} />
            ))}
          </div>
          <p className="text-xs text-muted">{BASIS_TEXT[shell.basis]}</p>
          <NumField label="Wall and floor thickness" value={wall} min={0} onCommit={onWall} />
          <p className="-mt-1 text-xs text-muted">Used by the outside check and by Rest on floor. It is a setting here and is not saved on the part.</p>
        </div>
      ) : (
        <form
          className="mt-2 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ready) return;
            setBusy(true);
            try {
              await onCreate(size as number[], basis as "doc" | "typical");
              setSize([null, null, null]);
              setBasis("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-secondary">There is no enclosure yet. Give its outer size to create one as a new part in the bill of materials.</p>
          <div className="grid grid-cols-3 gap-2">
            {(["Width x", "Height y", "Depth z"] as const).map((l, i) => (
              <NumField key={l} label={l} value={size[i]} positive placeholder="mm" onCommit={(n) => setSize((s) => s.map((v, k) => (k === i ? n : v)))} />
            ))}
          </div>
          <BasisPicker name="basis-new-enclosure" value={basis} onChange={setBasis} />
          <NumField label="Wall and floor thickness" value={wall} min={0} onCommit={onWall} />
          <div>
            <Button type="submit" size="sm" disabled={!ready || busy}>{busy ? "Creating" : "Create enclosure"}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
