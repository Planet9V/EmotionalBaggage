"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineEdit } from "@/components/parts/InlineEdit";
import { saveOrMessage, useItems } from "@/lib/client";
import { partLine, HREF } from "@/lib/economics/compute";
import { useEconomicsRows, useProductionSettings } from "@/lib/economics/client";
import { formatMoney, toMinor } from "@/lib/economics/money";
import { num, readPartInput, readSupplier } from "@/lib/economics/read";
import type { ViewProps } from "@/components/views/types";
import { PriceBreaksDialog } from "./PriceBreaksDialog";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Each part's unit price, quantity price breaks and supplier. The unit cost on Unit economics is
 * worked from these and from the line cost on the parts list when no unit price is entered.
 */
export function PartPricesView({ project, store }: ViewProps) {
  const settings = useProductionSettings(project.id);
  const parts = useItems(project.id, store);
  const { rows } = useEconomicsRows(project.id);
  const [breaksFor, setBreaksFor] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const currency = settings.currency;
  const inputs = useMemo(() => parts.items.map(readPartInput), [parts.items]);
  const suppliers = useMemo(() => rows.suppliers.map(readSupplier).filter((s) => s.code), [rows.suppliers]);
  const withoutCode = rows.suppliers.length - suppliers.length;

  if (parts.loading || settings.loading) return <LoadingBlocks label="Loading part prices" />;
  if (parts.error && !parts.items.length) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The parts could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{parts.error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void parts.reload()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!inputs.length) {
    return (
      <EmptyState title="No parts yet">
        Prices attach to parts.{" "}
        <Link href="/s/design/bom" className="text-link hover:underline">
          Add parts on Design, Bill of materials
        </Link>
        .
      </EmptyState>
    );
  }

  const fm = (m: number) => formatMoney(m, currency);
  const open = inputs.find((p) => p.id === breaksFor) ?? null;
  const setData = (id: number, data: Record<string, unknown>) => parts.patch(id, { data });

  return (
    <div className="space-y-4">
      {message || parts.writeError ? <ErrorLine>{message || parts.writeError}</ErrorLine> : null}
      <p className="max-w-3xl text-sm text-secondary">
        Enter the price of one piece in {currency}. Without a unit price the line cost from the parts list is used. A part with neither is not priced and the unit cost says so.
        {suppliers.length === 0 ? (
          <>
            {" "}
            There are no suppliers with a code yet.{" "}
            <Link href={HREF.suppliers} className="text-link hover:underline">
              Add a supplier
            </Link>{" "}
            and give it a code to link parts to it.
          </>
        ) : withoutCode ? (
          <> {withoutCode} {withoutCode === 1 ? "supplier has" : "suppliers have"} no code, so parts cannot link to {withoutCode === 1 ? "it" : "them"}.</>
        ) : null}
      </p>
      <Table>
        <caption className="sr-only">Unit price, price breaks and supplier of each part</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Part</TableHead>
            <TableHead scope="col" className="text-right">Qty per unit</TableHead>
            <TableHead scope="col" className="w-32 text-right">Unit price</TableHead>
            <TableHead scope="col">Price breaks</TableHead>
            <TableHead scope="col" className="text-right">Line cost</TableHead>
            <TableHead scope="col" className="w-48">Supplier</TableHead>
            <TableHead scope="col">Priced</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inputs.map((p) => {
            const l = partLine(p, 1, currency);
            const known = suppliers.some((s) => s.code === p.supplier);
            return (
              <TableRow key={p.id}>
                <TableCell className="text-primary">
                  {p.ref ? <span className="mr-2 font-mono text-xs text-secondary">{p.ref}</span> : null}
                  {p.title}
                </TableCell>
                <TableCell className="text-right font-mono">{p.qty ?? <span className="text-muted">none</span>}</TableCell>
                <TableCell className="text-right">
                  <InlineEdit
                    label={`Unit price of ${p.title}`}
                    value={p.unit === null ? "" : String(p.unit)}
                    placeholder="Set"
                    mono
                    numeric
                    align="right"
                    onSave={(v) => {
                      const n = num(v);
                      if (n === null || n < 0) return "Enter a number, zero or more.";
                      return saveOrMessage(setData(p.id, { unit: n }));
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setBreaksFor(p.id)}>
                    {p.breaks.length ? `${p.breaks.length} ${p.breaks.length === 1 ? "break" : "breaks"}` : "Add breaks"}
                    <span className="sr-only"> of {p.title}</span>
                  </Button>
                </TableCell>
                <TableCell className="text-right font-mono text-secondary">{p.line === null ? <span className="text-muted">none</span> : fm(toMinor(p.line, currency))}</TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={`Supplier of ${p.title}`}
                    value={p.supplier}
                    className="h-8 text-xs"
                    onChange={(e) => {
                      setMessage("");
                      setData(p.id, { supplier: e.target.value }).catch((err: Error) => setMessage(err.message));
                    }}
                  >
                    <option value="">No supplier</option>
                    {p.supplier && !known ? <option value={p.supplier}>{p.supplier} (not a supplier)</option> : null}
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.title} ({s.code})
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell>{l.missing ? <StatusBadge tone="warning">Not priced</StatusBadge> : <StatusBadge tone="success">Priced</StatusBadge>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <PriceBreaksDialog
        part={open}
        currency={currency}
        onClose={() => setBreaksFor(null)}
        onSave={async (id, breaks) => {
          await setData(id, { priceBreaks: breaks });
        }}
      />
    </div>
  );
}
