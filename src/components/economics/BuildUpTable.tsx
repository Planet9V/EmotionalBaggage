"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HREF, type CostLine, type UnitCost } from "@/lib/economics/compute";
import { formatMoney } from "@/lib/economics/money";
import { HowThisIsWorkedOut } from "./shared";

const GROUPS: { key: CostLine["group"]; title: string }[] = [
  { key: "part", title: "Parts" },
  { key: "line", title: "Per-unit lines" },
  { key: "scrap", title: "Scrap allowance" },
  { key: "setup", title: "Setup spread over the batch" },
];

/**
 * The unit cost as a table with subtotals, in the order it is built up. Rows that come from the
 * Unit economics section can be edited or removed here; a part's price is edited on Part prices.
 */
export function BuildUpTable({
  unit,
  onEdit,
  onRemove,
  printedRows,
}: {
  unit: UnitCost;
  onEdit?: (rowId: number) => void;
  onRemove?: (rowId: number) => void;
  /** a control per printed part (its material price per kg), shown under the part's line */
  printedRows?: Map<number, React.ReactNode>;
}) {
  const fm = (m: number) => formatMoney(m, unit.currency);
  const sub: Record<CostLine["group"], number> = {
    part: unit.partsSubtotal,
    line: unit.linesSubtotal,
    scrap: unit.scrap,
    setup: unit.setupSpread,
  };
  const editable = (l: CostLine) => l.group !== "part" && l.rowId !== null && (l.key.startsWith("cost:") || l.key.startsWith("method:"));
  const how = [
    ...unit.lines.map((l) => ({ label: l.label, how: l.how })),
    ...GROUPS.filter((g) => unit.lines.some((l) => l.group === g.key)).map((g) => ({ label: `${g.title} subtotal`, how: `${unit.lines.filter((l) => l.group === g.key).map((l) => (l.amount === null ? "(not priced)" : fm(l.amount))).join(" + ")} = ${fm(sub[g.key])}` })),
    { label: `Unit cost at ${unit.batchSize} ${unit.batchSize === 1 ? "unit" : "units"}`, how: `${fm(unit.partsSubtotal)} parts + ${fm(unit.linesSubtotal)} lines + ${fm(unit.scrap)} scrap + ${fm(unit.setupSpread)} setup = ${fm(unit.total)}` },
  ];

  return (
    <div>
      <Table>
        <caption className="sr-only">Unit cost at {unit.batchSize} units, line by line, with subtotals</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Line</TableHead>
            <TableHead scope="col" className="w-40 text-right">
              Per unit
            </TableHead>
            <TableHead scope="col" className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {GROUPS.filter((g) => unit.lines.some((l) => l.group === g.key)).map((g) => (
            <GroupRows key={g.key} title={g.title} subtotal={fm(sub[g.key])} lines={unit.lines.filter((l) => l.group === g.key)} fm={fm} editable={editable} onEdit={onEdit} onRemove={onRemove} printedRows={printedRows} />
          ))}
          <TableRow className="border-t-2 border-hairline bg-subtle">
            <TableCell className="font-semibold text-primary">
              Unit cost at {unit.batchSize} {unit.batchSize === 1 ? "unit" : "units"}
              {!unit.complete ? <StatusBadge tone="warning" className="ml-2">Incomplete</StatusBadge> : null}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary">{fm(unit.total)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      <HowThisIsWorkedOut lines={how} />
    </div>
  );
}

function GroupRows({
  title,
  subtotal,
  lines,
  fm,
  editable,
  onEdit,
  onRemove,
  printedRows,
}: {
  title: string;
  subtotal: string;
  lines: CostLine[];
  fm: (m: number) => string;
  editable: (l: CostLine) => boolean;
  onEdit?: (rowId: number) => void;
  onRemove?: (rowId: number) => void;
  printedRows?: Map<number, React.ReactNode>;
}) {
  return (
    <>
      <TableRow className="bg-subtle/50">
        <TableCell colSpan={3} className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">
          {title}
        </TableCell>
      </TableRow>
      {lines.map((l) => (
        <TableRow key={l.key}>
          <TableCell className="text-primary">
            {l.label}
            {l.group === "part" ? <span className="block text-[11px] text-muted" data-testid={`basis-${l.key}`}>{l.how}</span> : null}
            {l.group === "part" && l.rowId !== null && printedRows?.has(l.rowId) ? printedRows.get(l.rowId) : null}
            {l.missing ? (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <StatusBadge tone="warning">Not priced</StatusBadge>
                <Link href={l.missing.href} className="text-xs text-link hover:underline">
                  Fix it
                </Link>
              </span>
            ) : null}
          </TableCell>
          <TableCell className="text-right font-mono text-primary">{l.amount === null ? <span className="text-muted">not priced</span> : fm(l.amount)}</TableCell>
          <TableCell className="text-right">
            {editable(l) && l.rowId !== null && l.key.startsWith("cost:") ? (
              <span className="inline-flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${l.label}`} onClick={() => onEdit?.(l.rowId!)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${l.label}`} onClick={() => onRemove?.(l.rowId!)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </span>
            ) : l.key.startsWith("method:") ? (
              <Link href={HREF.methods} className="text-xs text-link hover:underline">
                Method
              </Link>
            ) : null}
          </TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="text-right text-xs text-secondary">{title} subtotal</TableCell>
        <TableCell className="text-right font-mono text-xs font-medium text-secondary">{subtotal}</TableCell>
        <TableCell />
      </TableRow>
    </>
  );
}
