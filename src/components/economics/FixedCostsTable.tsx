"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FixedCosts } from "@/lib/economics/compute";
import { formatMoney } from "@/lib/economics/money";
import { HowThisIsWorkedOut, MissingList } from "./shared";

/** Costs paid once however many units are made: the figure break-even divides by. */
export function FixedCostsTable({ fixed, currency }: { fixed: FixedCosts; currency: string }) {
  const fm = (m: number) => formatMoney(m, currency);
  if (!fixed.lines.length && !fixed.missing.length) {
    return <p className="text-sm text-secondary">No fixed costs yet. Add tooling, certification or setup as a cost line, or enter tooling on a manufacturing method.</p>;
  }
  return (
    <div className="space-y-3">
      <Table>
        <caption className="sr-only">Costs paid once</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Cost</TableHead>
            <TableHead scope="col" className="w-40 text-right">Once</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixed.lines.map((l) => (
            <TableRow key={l.key}>
              <TableCell className="text-primary">{l.label}</TableCell>
              <TableCell className="text-right font-mono">{fm(l.amount)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 border-hairline bg-subtle">
            <TableCell className="font-semibold text-primary">Fixed costs in all</TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary">{fm(fixed.total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <MissingList items={fixed.missing} title="Fixed costs with no amount" />
      <HowThisIsWorkedOut lines={[...fixed.lines.map((l) => ({ label: l.label, how: l.how })), { label: "Fixed costs in all", how: `${fixed.lines.map((l) => fm(l.amount)).join(" + ") || fm(0)} = ${fm(fixed.total)}` }]} />
    </div>
  );
}
