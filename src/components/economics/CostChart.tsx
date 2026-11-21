"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SizePoint } from "@/lib/economics/compute";
import { formatMoney, minorDigits, toMajor } from "@/lib/economics/money";

const config = { unitCost: { label: "Unit cost", color: "var(--color-dutchOrange-500)" } } satisfies ChartConfig;

/**
 * Unit cost against batch size: the one chart of the economics. The same numbers are a table, which
 * is also what a screen reader reads (the chart itself is hidden from assistive technology).
 */
export function CostChart({ points, currency }: { points: SizePoint[]; currency: string }) {
  const [showTable, setShowTable] = useState(false);
  if (points.length < 2) {
    return <p className="text-sm text-secondary">Add a second batch size to see how the unit cost changes with volume.</p>;
  }
  const data = points.map((p) => ({ size: p.size.toLocaleString("en"), unitCost: toMajor(p.unitCost, currency) }));
  const incomplete = points.some((p) => p.missing > 0);
  const first = points[0];
  const last = points[points.length - 1];
  const back = (v: number) => Math.round(v * 10 ** minorDigits(currency));
  const verb = last.unitCost < first.unitCost ? "falls from" : last.unitCost > first.unitCost ? "rises from" : "stays at";
  const trend = `Unit cost ${verb} ${formatMoney(first.unitCost, currency)} at ${first.size.toLocaleString("en")} ${first.size === 1 ? "unit" : "units"}${verb === "stays at" ? "" : ` to ${formatMoney(last.unitCost, currency)} at ${last.size.toLocaleString("en")} units`}.`;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-secondary">{trend}{incomplete ? " Some lines are not priced, so the cost is understated." : ""}</span>
        <Button variant="outline" size="sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Show the chart" : "Show as a table"}
        </Button>
      </figcaption>
      {!showTable ? (
        <div aria-hidden="true">
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="size" tickLine={false} axisLine={false} tickMargin={8} label={{ value: "Batch size (units)", position: "insideBottom", offset: -4 }} height={48} />
              <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatMoney(back(v), currency)} />
              <ChartTooltip content={<ChartTooltipContent hideLabel={false} formatter={(v) => <span className="font-mono">{formatMoney(back(Number(v)), currency)}</span>} />} />
              <Line dataKey="unitCost" type="monotone" stroke="var(--color-unitCost)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        </div>
      ) : null}
      <div className={showTable ? "" : "sr-only"}>
        <Table>
          <caption className="sr-only">Unit cost at each batch size</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Batch size</TableHead>
              <TableHead scope="col" className="text-right">Unit cost</TableHead>
              <TableHead scope="col" className="text-right">Lines not priced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p) => (
              <TableRow key={p.size}>
                <TableCell className="font-mono">{p.size.toLocaleString("en")}</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(p.unitCost, currency)}</TableCell>
                <TableCell className="text-right font-mono">{p.missing}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
