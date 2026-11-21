"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { num } from "@/lib/economics/read";
import { COST_KINDS, COST_KIND_LABEL, METHOD_STATUSES, type CostKind } from "@/lib/economics/schemas";
import type { Item } from "@/lib/types";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";

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

const costSchema = z
  .object({ kind: z.string(), title: z.string(), status: z.string(), values: z.record(z.string(), z.string()) })
  .superRefine((v, ctx) => {
    for (const f of FIELDS[v.kind as CostKind] ?? []) {
      const n = num(v.values[f.key]);
      if (n === null || n < 0) ctx.addIssue({ code: "custom", path: ["values", f.key], message: `${f.label}: enter a number, zero or more.` });
      else if (f.key === "percent" && n > 100) ctx.addIssue({ code: "custom", path: ["values", f.key], message: `${f.label}: cannot be more than 100.` });
    }
  });
type Values = z.infer<typeof costSchema>;

function Form({ productType, initial, onCancel, onSave }: { productType: string; initial: Item | null; onCancel: () => void; onSave: (v: { title: string; status: string; data: Record<string, unknown> }) => Promise<void> }) {
  const kinds = kindsFor(productType);
  const startKind = (COST_KINDS as readonly string[]).includes(String(initial?.data.kind)) ? (String(initial?.data.kind) as CostKind) : kinds[0];
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(costSchema),
    defaultValues: {
      kind: startKind,
      title: initial?.title ?? "",
      status: initial?.status ?? METHOD_STATUSES[0],
      values: Object.fromEntries(Object.entries(initial?.data ?? {}).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => [k, String(v)])),
    },
  });
  const kind = useWatch({ control, name: "kind" }) as CostKind;
  const fields = FIELDS[kind];

  const submit = handleSubmit(async (v) => {
    const data: Record<string, unknown> = { kind };
    for (const f of fields) data[f.key] = num(v.values[f.key]);
    try {
      await onSave({ title: v.title.trim() || COST_KIND_LABEL[kind], status: v.status, data });
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="cost-kind" label="Kind of cost">
        <NativeSelect id="cost-kind" {...register("kind")}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {COST_KIND_LABEL[k]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="cost-name" label="Name" hint={`Shown in the table. Left empty it reads "${COST_KIND_LABEL[kind]}".`}>
        <Input id="cost-name" placeholder={COST_KIND_LABEL[kind]} {...register("title")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={`${kind}-${f.key}`} id={`cost-${f.key}`} label={f.label} hint={f.hint} error={errors.values?.[f.key]?.message}>
            <Input id={`cost-${f.key}`} inputMode="decimal" aria-invalid={!!errors.values?.[f.key]} {...register(`values.${f.key}`)} />
          </Field>
        ))}
      </div>
      <Field id="cost-status" label="How sure is it">
        <NativeSelect id="cost-status" {...register("status")}>
          {METHOD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {errors.root?.message ? <ErrorLine>{errors.root.message}</ErrorLine> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
