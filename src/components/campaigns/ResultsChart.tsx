"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toMajor } from "@/lib/economics/money";
import type { ByDay } from "@/lib/campaigns/metrics";
import { formatDay } from "@/lib/campaigns/days";
import type { useMoney } from "./hooks";

type Money = ReturnType<typeof useMoney>;
const config = {
  spend: { label: "Spend", color: "var(--color-dutchOrange-500)" },
  orders: { label: "Orders", color: "var(--color-info, #2563eb)" },
} satisfies ChartConfig;

/** The one chart of a campaign: spend (bars) and orders (line) by day. The same numbers are a table, which is what a screen reader reads. */
export function ResultsChart({ days, money }: { days: ByDay[]; money: Money }) {
  const [table, setTable] = useState(false);
  if (days.length === 0) return null;
  const data = days.map((d) => ({ day: d.day.slice(5), spend: toMajor(d.spend, money.currency), orders: d.orders }));
  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-secondary">Spend in {money.currency} (bars) and orders (line), by day.</span>
        <Button variant="outline" size="sm" aria-pressed={table} onClick={() => setTable((v) => !v)}>{table ? "Show the chart" : "Show as a table"}</Button>
      </figcaption>
      {table ? (
        <Table>
          <TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Spend</TableHead><TableHead className="text-right">Orders</TableHead></TableRow></TableHeader>
          <TableBody>{days.map((d) => <TableRow key={d.day}><TableCell>{formatDay(d.day)}</TableCell><TableCell className="text-right font-mono">{money.format(d.spend)}</TableCell><TableCell className="text-right font-mono">{d.orders}</TableCell></TableRow>)}</TableBody>
        </Table>
      ) : (
        <div aria-hidden="true">
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <ComposedChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis yAxisId="l" tickLine={false} axisLine={false} width={56} />
              <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar yAxisId="l" dataKey="spend" fill="var(--color-spend)" radius={2} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="orders" type="monotone" stroke="var(--color-orders)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ChartContainer>
        </div>
      )}
    </figure>
  );
}
