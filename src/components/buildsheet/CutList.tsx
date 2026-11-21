"use client";

import { COLOUR_SWATCH, ROUND_TO, totalsByClass, type CutRow } from "./derive";
import { NET_COLOR } from "@/lib/domain";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  rows: CutRow[];
  routing: string;
  allowance: string;
  onRouting: (v: string) => void;
  onAllowance: (v: string) => void;
  routingValue: number;
  allowanceValue: number;
  routingOk: boolean;
  allowanceOk: boolean;
};

export function CutList({ rows, routing, allowance, onRouting, onAllowance, routingValue, allowanceValue, routingOk, allowanceOk }: Props) {
  const totals = totalsByClass(rows);
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-end gap-4 rounded-xl border border-hairline bg-subtle p-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-secondary">Routing factor</span>
          <Input inputMode="decimal" value={routing} onChange={(e) => onRouting(e.target.value)} className="h-8 w-24 font-mono" aria-invalid={!routingOk} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-secondary">Strip and slack (mm)</span>
          <Input inputMode="decimal" value={allowance} onChange={(e) => onAllowance(e.target.value)} className="h-8 w-24 font-mono" aria-invalid={!allowanceOk} />
        </label>
        {(!routingOk || !allowanceOk) && (
          <p role="alert" className="text-xs text-danger">Enter a number, zero or more. The last valid values are still in use.</p>
        )}
      </div>
      <p className="text-xs text-secondary">
        <strong className="font-medium text-primary">Routed</strong> = the path the planner found through the enclosure + {allowanceValue} mm (strip and slack), rounded up to {ROUND_TO} mm.{" "}
        <strong className="font-medium text-primary">Estimate</strong> = straight-line distance between the two parts&apos; assembled centres × {routingValue} (routing factor) + {allowanceValue} mm, rounded up to {ROUND_TO} mm; it stands in for any wire that is not routed, or whose route is out of date. Route wires in the 3D model. Colours are suggested.
      </p>
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Step</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Colour (suggested)</TableHead>
              <TableHead className="text-right">Length</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.wire.item.id}>
                <TableCell className="font-mono">{String(r.step).padStart(2, "0")}</TableCell>
                <TableCell className="font-mono text-primary">{r.wire.from}.{r.wire.fromPin}</TableCell>
                <TableCell className="font-mono text-primary">{r.wire.to}.{r.wire.toPin}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bs-dot inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NET_COLOR[r.wire.netClass] }} aria-hidden />
                    {r.wire.netClass}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    {COLOUR_SWATCH[r.colour] && (
                      <span className="bs-dot inline-block h-3 w-3 rounded-full border border-hairline" style={{ backgroundColor: COLOUR_SWATCH[r.colour] }} aria-hidden />
                    )}
                    {r.colour}
                    {r.wire.netClass === "signal" && <span className="text-muted">for {r.wire.net || "no net"}</span>}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {r.length ? (
                    <span
                      title={
                        r.length.source === "routed"
                          ? `${r.length.straight.toFixed(1)} mm routed${r.length.cellMm ? ` on ${r.length.cellMm} mm cells` : ""} + ${allowanceValue} = ${r.length.raw.toFixed(1)} mm, rounded up`
                          : `${r.length.straight.toFixed(1)} mm straight x ${routingValue} + ${allowanceValue} = ${r.length.raw.toFixed(1)} mm, rounded up`
                      }
                      className="text-primary"
                    >
                      {r.length.mm} mm
                      <span className={`ml-1.5 font-sans text-[11px] ${r.length.source === "routed" ? "text-success" : "text-muted"}`}>
                        {r.length.source === "routed" ? "routed" : r.length.stale ? "estimate, route out of date" : "estimate"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">no geometry</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-secondary" aria-label="Total length per class">
        {totals.map((t) => (
          <li key={t.netClass} className="font-mono">
            {t.netClass}: <span className="text-primary">{t.mm} mm</span>
            <span className="text-muted"> ({t.routed} routed, {t.estimated} estimated{t.counted < t.wires ? `, ${t.wires - t.counted} with no length` : ""})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
