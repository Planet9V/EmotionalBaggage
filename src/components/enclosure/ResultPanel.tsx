"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GENERATORS } from "@/lib/enclosure/types";
import { downloadFile } from "@/lib/download";
import { bytesOf, meshOf, type ResultOk } from "./client";
import { Card } from "@/components/ui/Card";

const EnclosureCanvas = dynamic(() => import("./EnclosureCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Loading the 3D viewer.</p>,
});

export function ChecksList({ checks }: { checks: ResultOk["checks"] }) {
  return (
    <ul className="space-y-2" aria-label="Checks computed on the generated meshes">
      {checks.map((c) => (
        <li key={c.key} className="flex gap-2 text-sm">
          {c.ok ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />}
          <div className="min-w-0">
            <p className="text-primary">
              {c.label}: <span className={c.ok ? "font-medium text-success" : "font-medium text-danger"}>{c.ok ? "met" : "not met"}</span>
            </p>
            <p className="text-xs text-secondary wrap-anywhere">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ResultPanel({ result, dark, floorY, slug, stale }: { result: ResultOk; dark: boolean; floorY: number; slug: string; stale: boolean }) {
  const meta = GENERATORS[result.key];
  const [lift, setLift] = useState(0);
  const meshes = useMemo(
    () => [
      { id: `${result.key}-base`, kind: "base" as const, mesh: meshOf(result.baseStl) },
      { id: `${result.key}-lid`, kind: "lid" as const, mesh: meshOf(result.lidStl) },
    ],
    [result]
  );
  const liftId = `lift-${result.key}`;
  const download3mf = async () => {
    const { piecesTo3mf } = await import("@/lib/enclosure/printFiles");
    const bytes = await piecesTo3mf([{ name: "base", mesh: meshOf(result.basePrintStl) }, { name: "lid", mesh: meshOf(result.lidPrintStl) }], `${slug}-${result.key}`);
    downloadFile(`${slug}-${result.key}-base-and-lid.3mf`, bytes, "model/3mf");
  };
  const failed = result.checks.filter((c) => !c.ok).length;
  return (
    <Card variant="flat" as="section" aria-labelledby={`res-${result.key}`} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
        <h3 id={`res-${result.key}`} className="text-sm font-semibold text-primary">
          {meta.label}
        </h3>
        <p className="text-xs text-muted">
          {result.version}, {result.seconds.toFixed(1)} s
        </p>
      </div>
      <div className="space-y-4 p-4">
        {stale ? (
          <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            This was generated from earlier settings or parts. Generate again to match what is on screen.
          </p>
        ) : null}
        <Card variant="well" className="rounded-lg h-72 overflow-hidden">
          <EnclosureCanvas meshes={meshes} lift={lift} dark={dark} floorY={floorY} label={`${meta.label} base and lid, drag to turn`} />
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={liftId} className="text-xs text-secondary">
            Lift the lid ({lift} mm)
          </label>
          <input id={liftId} type="range" min={0} max={60} step={1} value={lift} onChange={(e) => setLift(Number(e.target.value))} className="w-48 accent-[var(--focus-ring)]" />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
            Checks {failed ? `(${failed} not met)` : "(all met)"}
          </p>
          <ChecksList checks={result.checks} />
        </div>
        {result.notes.length ? (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Notes from the generator</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadFile(`${slug}-${result.key}-base.stl`, bytesOf(result.basePrintStl), "model/stl")}>
            <Download aria-hidden className="size-4" /> Base STL
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile(`${slug}-${result.key}-lid.stl`, bytesOf(result.lidPrintStl), "model/stl")}>
            <Download aria-hidden className="size-4" /> Lid STL (outer face down)
          </Button>
          <Button variant="outline" size="sm" onClick={() => void download3mf()}>
            <Download aria-hidden className="size-4" /> Base and lid 3MF
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile(`${slug}-${result.source.filename}`, result.source.text, "text/plain")}>
            <Download aria-hidden className="size-4" /> Generator source
          </Button>
        </div>
        <p className="text-xs text-muted">The STL and 3MF files are Z up, as slicers read them, each piece on the plate; the lid is turned over. {result.source.note}</p>
      </div>
    </Card>
  );
}
