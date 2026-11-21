"use client";

// A strip chart of prices on one number line: competitors as circles above the line, your candidate
// prices as diamonds below it, and the unit cost as a dashed vertical line. Shapes and labels carry
// the meaning, not colour alone. A table of the same numbers is one toggle away.
import { useId, useState } from "react";
import { formatMoney } from "@/lib/economics/money";

export type StripPoint = { id: string; label: string; minor: number; kind: "competitor" | "unsourced" | "candidate" };

const W = 720;
const PAD = 36;
const LINE_Y = 90;

export function PriceStrip({ points, unitCostMinor, currency }: { points: StripPoint[]; unitCostMinor: number | null; currency: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();
  const values = [...points.map((p) => p.minor), ...(unitCostMinor ? [unitCostMinor] : [])];
  if (!values.length) return <p className="text-sm text-secondary">Nothing to plot yet. Add a competitor price or a candidate price.</p>;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(hi, 100);
  const min = Math.max(0, lo - span * 0.12);
  const max = hi + span * 0.12;
  const x = (m: number) => PAD + ((m - min) / (max - min || 1)) * (W - PAD * 2);
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

  // Stagger labels on each side so near prices do not print on top of each other.
  const above = points.filter((p) => p.kind !== "candidate").sort((a, b) => a.minor - b.minor);
  const below = points.filter((p) => p.kind === "candidate").sort((a, b) => a.minor - b.minor);

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Chart or table" className="inline-flex overflow-hidden rounded-md border border-hairline">
        {(["chart", "table"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-8 px-3 text-xs capitalize focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dutchOrange ${view === v ? "bg-subtle font-medium text-primary" : "bg-surface text-secondary hover:text-primary"}`}>
            {v}
          </button>
        ))}
      </div>
      {view === "chart" ? (
        <svg viewBox={`0 0 ${W} 190`} role="img" aria-labelledby={titleId} className="w-full max-w-4xl text-secondary">
          <title id={titleId}>Prices on one line: competitors above, your candidate prices below{unitCostMinor ? ", and your unit cost as a dashed line" : ""}.</title>
          <line x1={PAD} x2={W - PAD} y1={LINE_Y} y2={LINE_Y} stroke="currentColor" strokeWidth={1} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={LINE_Y - 4} y2={LINE_Y + 4} stroke="currentColor" />
              <text x={x(t)} y={LINE_Y + 20} textAnchor="middle" fontSize={10} fill="currentColor" className="font-mono">{formatMoney(Math.round(t), currency)}</text>
            </g>
          ))}
          {unitCostMinor ? (
            <g>
              <line x1={x(unitCostMinor)} x2={x(unitCostMinor)} y1={14} y2={176} stroke="currentColor" strokeDasharray="4 3" />
              <text x={x(unitCostMinor) + 4} y={12} fontSize={10} fill="currentColor" className="font-mono">unit cost {formatMoney(unitCostMinor, currency)}</text>
            </g>
          ) : null}
          {above.map((p, i) => (
            <g key={p.id}>
              {p.kind === "unsourced" ? <circle cx={x(p.minor)} cy={LINE_Y} r={6} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" /> : <circle cx={x(p.minor)} cy={LINE_Y} r={6} fill="currentColor" />}
              <text x={x(p.minor)} y={LINE_Y - 14 - (i % 3) * 13} textAnchor="middle" fontSize={10} fill="currentColor">{p.label}{p.kind === "unsourced" ? " (unsourced)" : ""}</text>
            </g>
          ))}
          {below.map((p, i) => (
            <g key={p.id}>
              <path d={`M ${x(p.minor)} ${LINE_Y - 7} l 7 7 l -7 7 l -7 -7 z`} fill="var(--color-dutchOrange, #E05A10)" stroke="currentColor" strokeWidth={0.5} />
              <text x={x(p.minor)} y={LINE_Y + 38 + (i % 3) * 13} textAnchor="middle" fontSize={10} fill="currentColor" className="font-semibold">{p.label}</text>
            </g>
          ))}
        </svg>
      ) : (
        <table className="w-full max-w-xl text-sm">
          <caption className="sr-only">The same prices as a table</caption>
          <thead><tr className="border-b border-hairline text-left text-xs text-muted"><th className="py-1 pr-3 font-medium">What</th><th className="py-1 pr-3 font-medium">Kind</th><th className="py-1 text-right font-medium">Price</th></tr></thead>
          <tbody>
            {[...points, ...(unitCostMinor ? [{ id: "cost", label: "Unit cost", minor: unitCostMinor, kind: "cost" as const }] : [])].sort((a, b) => a.minor - b.minor).map((p) => (
              <tr key={p.id} className="border-b border-hairline">
                <td className="py-1 pr-3 text-primary">{p.label}</td>
                <td className="py-1 pr-3 text-secondary">{p.kind === "candidate" ? "Your candidate" : p.kind === "competitor" ? "Competitor" : p.kind === "unsourced" ? "Competitor, unsourced" : "Cost"}</td>
                <td className="py-1 text-right font-mono">{formatMoney(p.minor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
