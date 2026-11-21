"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItems } from "@/lib/client";
import { batchResults, channelResults, costBySize, fixedCosts, HREF, unitCost, wholeBatch } from "@/lib/economics/compute";
import { useEconomicsRows, useProductionSettings } from "@/lib/economics/client";
import { CURRENCIES } from "@/lib/economics/money";
import { readEconomics } from "@/lib/economics/read";
import { STORE_ECONOMICS } from "@/lib/economics/schemas";
import type { ViewProps } from "@/components/views/types";
import { BuildUpTable } from "./BuildUpTable";
import { ChannelTable } from "./ChannelTable";
import { CostChart } from "./CostChart";
import { CostLineDialog } from "./CostLineDialog";
import { FixedCostsTable } from "./FixedCostsTable";
import { MissingList } from "./shared";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { NativeSelect } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";

/** Batch sizes the chart always shows, plus every planned batch. */
const LADDER = [1, 10, 100, 1000, 10000];

export function EconomicsView({ project }: ViewProps) {
  const settings = useProductionSettings(project.id);
  const { rows, loading, error, reload } = useEconomicsRows(project.id);
  const costs = useItems(project.id, STORE_ECONOMICS);
  const [size, setSize] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [message, setMessage] = useState("");

  const currency = settings.currency;
  const inputs = useMemo(() => readEconomics(rows, currency), [rows, currency]);
  const firstPlanned = inputs.batches.find((b) => b.units !== null)?.units ?? 1;
  const batchSize = wholeBatch(Number(size ?? firstPlanned));
  const unit = useMemo(() => unitCost(inputs, batchSize), [inputs, batchSize]);
  const fixed = useMemo(() => fixedCosts(inputs), [inputs]);
  const channels = useMemo(() => channelResults(inputs.channels, unit, fixed), [inputs.channels, unit, fixed]);
  const points = useMemo(() => costBySize(inputs, [...LADDER, ...batchResults(inputs).flatMap((b) => (b.units ? [b.units] : []))]), [inputs]);

  if (loading || settings.loading) return <LoadingBlocks label="Loading the economics" />;
  if (error || settings.error) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The economics could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{error || settings.error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void (error ? reload() : settings.reload())}>
          Try again
        </Button>
      </div>
    );
  }

  if (!inputs.parts.length && !inputs.costs.length) {
    return (
      <EmptyState title="No parts or costs yet">
        The unit cost is built from the parts list and the lines you add here.{" "}
        <Link href="/s/design/bom" className="text-link hover:underline">
          Add parts on Design, Bill of materials
        </Link>
        , then price them on{" "}
        <Link href={HREF.parts} className="text-link hover:underline">
          Part prices
        </Link>
        .
      </EmptyState>
    );
  }

  const editingRow = typeof editing === "number" ? rows.economics.find((r) => r.id === editing) ?? null : null;
  const remove = async (id: number) => {
    setMessage("");
    try {
      await costs.remove(id);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-secondary">Figures for a batch of</span>
          <span className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              className="w-28"
              aria-label="Batch size in units"
              value={size ?? String(firstPlanned)}
              onChange={(e) => setSize(e.target.value.replace(/[^\d]/g, ""))}
            />
            <span className="text-sm text-secondary">units</span>
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-secondary">Currency</span>
          <NativeSelect
            value={currency}
            aria-label="Currency"
            onChange={(e) => {
              setMessage("");
              settings.save({ currency: e.target.value }).catch((err: Error) => setMessage(err.message));
            }}
            className="w-28"
          >
            {[...new Set([currency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </label>
        <p className="max-w-md pb-2 text-xs text-secondary">Every amount is in one currency. Nothing is converted. A price break or setup cost follows the batch size.</p>
        <div className="ml-auto">
          <Button id="add-row" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add cost line
          </Button>
        </div>
      </div>
      {message || costs.writeError ? <ErrorLine>{message || costs.writeError}</ErrorLine> : null}

      <Panel compact id="build-up" title="Unit cost build-up" description="Every figure is worked out from the parts list and the lines below. Nothing here is typed in.">
        <div className="space-y-3">
          <BuildUpTable unit={unit} onEdit={setEditing} onRemove={(id) => void remove(id)} />
          <MissingList items={unit.missing} />
        </div>
      </Panel>

      <Panel compact id="channels" title="Margin by channel" description={`At a unit cost of the batch size above. Prices and fees come from the sales channels.`}>
        {channels.length ? (
          <ChannelTable results={channels} currency={currency} />
        ) : (
          <p className="text-sm text-secondary">
            No sales channels yet.{" "}
            <Link href={HREF.channels} className="text-link hover:underline">
              Add a channel with its price and fees
            </Link>{" "}
            to see the margin.
          </p>
        )}
      </Panel>

      <Panel compact id="fixed" title="Fixed costs and break-even" description="Paid once however many units are made. Break-even in the table above divides these by the margin per unit.">
        <FixedCostsTable fixed={fixed} currency={currency} />
      </Panel>

      <Panel compact id="by-size" title="Unit cost by batch size" description="Price breaks lower the parts cost as the order grows; setup is spread over more units.">
        <CostChart points={points} currency={currency} />
      </Panel>

      {unit.ignored.length ? (
        <details className="rounded-xl border border-hairline bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-secondary">
            Earlier typed rows ({unit.ignored.length}), not used in any figure
          </summary>
          <p className="mt-2 text-xs text-secondary">These were typed by hand before costs were worked out. Re-enter what still matters as a cost line, then remove the row.</p>
          <ul className="mt-2 divide-y divide-hairline">
            {unit.ignored.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-primary">{r.title}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.title}`} onClick={() => void remove(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <CostLineDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        productType={settings.productType}
        currency={currency}
        initial={editingRow}
        onSave={async (v) => {
          if (editingRow) await costs.patch(editingRow.id, { title: v.title, status: v.status, data: v.data });
          else await costs.add({ section: STORE_ECONOMICS, title: v.title, status: v.status, data: v.data });
          setEditing(null);
        }}
      />
    </div>
  );
}
