"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HREF, type ChannelResult } from "@/lib/economics/compute";
import { formatMoney, formatPercent } from "@/lib/economics/money";
import { HowThisIsWorkedOut, MissingList } from "./shared";

/** Margin per unit and break-even for each sales channel, at the unit cost above. */
export function ChannelTable({ results, currency }: { results: ChannelResult[]; currency: string }) {
  const fm = (m: number) => formatMoney(m, currency);
  return (
    <div className="space-y-3">
      <Table>
        <caption className="sr-only">Margin per unit and break-even units for each sales channel</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Channel</TableHead>
            <TableHead scope="col" className="text-right">Price</TableHead>
            <TableHead scope="col" className="text-right">Unit cost</TableHead>
            <TableHead scope="col" className="text-right">Fees, fulfilment, returns, ads</TableHead>
            <TableHead scope="col" className="text-right">Margin per unit</TableHead>
            <TableHead scope="col" className="text-right">Margin</TableHead>
            <TableHead scope="col" className="text-right">Break-even</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => {
            const selling = r.platformFee + r.paymentFee + r.fulfilment + r.returns + r.adCost;
            const blank = <span className="text-muted">not set</span>;
            return (
              <TableRow key={r.id}>
                <TableCell className="text-primary">
                  {r.title}
                  {!r.complete ? <StatusBadge tone="warning" className="ml-2">Incomplete</StatusBadge> : null}
                </TableCell>
                <TableCell className="text-right font-mono">{r.price === null ? blank : fm(r.price)}</TableCell>
                <TableCell className="text-right font-mono">{fm(r.unitCost)}</TableCell>
                <TableCell className="text-right font-mono">{r.price === null ? blank : fm(selling)}</TableCell>
                <TableCell className={`text-right font-mono font-medium ${r.margin !== null && r.margin < 0 ? "text-danger" : "text-primary"}`}>{r.margin === null ? blank : fm(r.margin)}</TableCell>
                <TableCell className="text-right font-mono">{r.marginPercent === null ? blank : formatPercent(r.marginPercent)}</TableCell>
                <TableCell className="text-right font-mono" title={r.breakEven?.reason}>
                  {r.breakEven === null ? blank : r.breakEven.units === null ? <span className="text-danger">never</span> : `${r.breakEven.units.toLocaleString("en")} units`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <MissingList items={results.flatMap((r) => r.missing)} title="Missing from the channels" />
      <HowThisIsWorkedOut lines={results.flatMap((r) => r.how.map((h, i) => ({ label: i === 0 ? r.title : "", how: h })))} />
      <p className="text-xs text-secondary">
        Prices and fees are set on{" "}
        <Link href={HREF.channels} className="text-link hover:underline">
          Sales, Channels and pricing
        </Link>
        .
      </p>
    </div>
  );
}
