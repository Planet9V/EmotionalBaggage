"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine, Field, Select } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { num } from "@/lib/economics/read";
import { COST_KINDS, COST_KIND_LABEL, METHOD_STATUSES, type CostKind } from "@/lib/economics/schemas";
import type { Item } from "@/lib/types";

type FieldSpec = { key: string; label: string; hint?: string };

const FIELDS: Record<CostKind, FieldSpec[]> = {
  packaging: [{ key: "amount", label: "Amount per unit" }],
  "shipping-in": [{ key: "amount", label: "Amount per unit" }],
  "other-unit": [{ key: "amount", label: "Amount per unit" }],
  labour: [
    { key: "labourMinutes", label: "Minutes per unit" },
    { key: "rate", label: "Rate per hour" },
  ],
  "print-material": [
    { key: "grams", label: "Grams per unit" },
    { key: "pricePerKg", label: "Price per kilogram" },
  ],
  "print-time": [
    { key: "printMinutes", label: "Print minutes per unit" },
    { key: "machineRate", label: "Machine rate per hour" },
  ],
  scrap: [{ key: "percent", label: "Scrap allowance (%)", hint: "Applied to parts and per-unit lines." }],
  tooling: [{ key: "amount", label: "Amount, paid once" }],
  certification: [{ key: "amount", label: "Amount, paid once" }],
  setup: [{ key: "amount", label: "Amount per batch", hint: "Spread over the batch size." }],
};

/** Print kinds make no sense for a product with nothing printed. */
const HIDDEN_FOR: Record<string, CostKind[]> = { physical: ["print-material", "print-time"] };

export function kindsFor(productType: string): CostKind[] {
  const hide = HIDDEN_FOR[productType] ?? [];
  return COST_KINDS.filter((k) => !hide.includes(k));
}

export function CostLineDialog({
  open,
  onOpenChange,
  productType,
  currency,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productType: string;
  currency: string;
  initial?: Item | null;
  onSave: (v: { title: string; status: string; data: Record<string, unknown> }) => Promise<void>;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Edit cost line" : "Add cost line"} description={`Amounts are in ${currency}.`}>
      {open ? <Form key={initial?.id ?? "new"} productType={productType} initial={initial ?? null} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
    </Modal>
  );
}

function Form({ productType, initial, onCancel, onSave }: { productType: string; initial: Item | null; onCancel: () => void; onSave: (v: { title: string; status: string; data: Record<string, unknown> }) => Promise<void> }) {
  const kinds = kindsFor(productType);
  const startKind = (COST_KINDS as readonly string[]).includes(String(initial?.data.kind)) ? (String(initial?.data.kind) as CostKind) : kinds[0];
  const [kind, setKind] = useState<CostKind>(startKind);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState(initial?.status ?? METHOD_STATUSES[0]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial?.data ?? {}).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => [k, String(v)])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = FIELDS[kind];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = { kind };
    for (const f of fields) {
      const n = num(values[f.key]);
      if (n === null || n < 0) return setError(`${f.label}: enter a number, zero or more.`);
      if (f.key === "percent" && n > 100) return setError(`${f.label}: cannot be more than 100.`);
      data[f.key] = n;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ title: title.trim() || COST_KIND_LABEL[kind], status, data });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Kind of cost">
        <Select value={kind} onChange={(e) => setKind(e.target.value as CostKind)} aria-label="Kind of cost">
          {kinds.map((k) => (
            <option key={k} value={k}>
              {COST_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name" hint={`Shown in the table. Left empty it reads "${COST_KIND_LABEL[kind]}".`}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={COST_KIND_LABEL[kind]} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Input inputMode="decimal" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} aria-label={f.label} />
          </Field>
        ))}
      </div>
      <Field label="How sure is it">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="How sure is it">
          {METHOD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
