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
        Length estimate = straight-line distance between the two parts&apos; assembled centres × {routingValue} (routing factor) + {allowanceValue} mm (strip and slack), rounded up to {ROUND_TO} mm. Every length below is an estimate. Colours are suggested.
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
              <TableHead className="text-right">Length (estimate)</TableHead>
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
                    <span title={`${r.length.straight.toFixed(1)} mm straight x ${routingValue} + ${allowanceValue} = ${r.length.raw.toFixed(1)} mm, rounded-sm up`} className="text-primary">
                      {r.length.mm} mm
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
            {t.netClass}: <span className="text-primary">{t.mm} mm</span> estimate
            {t.counted < t.wires && <span className="text-muted"> ({t.counted} of {t.wires} wires have geometry)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
