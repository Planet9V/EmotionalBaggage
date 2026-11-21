"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readBatch } from "@/lib/economics/read";
import type { Item } from "@/lib/types";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";
import { statusesFor } from "@/lib/menuLookup";

const STATUSES = statusesFor("production/batches");
export type BatchDraft = { title: string; status: string; data: { units: number; targetDate: string; build: string } };

export function BatchDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: Item | null; onSave: (v: BatchDraft) => Promise<void> }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Edit batch" : "Add batch"} description="A batch is one build run: how many units, by when, from which build.">
      {open ? <Form key={initial?.id ?? "new"} initial={initial ?? null} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
    </Modal>
  );
}

const schema = z.object({
  title: z.string().trim().min(1, "Give the batch a name."),
  units: z.string().refine((v) => {
    const n = Number(v.replace(/,/g, ""));
    return Number.isInteger(n) && n >= 1;
  }, "Units: enter a whole number of at least 1."),
  date: z.string(),
  build: z.string(),
  status: z.string(),
});
type Values = z.infer<typeof schema>;

function Form({ initial, onCancel, onSave }: { initial: Item | null; onCancel: () => void; onSave: (v: BatchDraft) => Promise<void> }) {
  const was = initial ? readBatch(initial) : null;
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: initial?.title ?? "", units: was?.units ? String(was.units) : "", date: was?.targetDate ?? "", build: was?.build ?? "", status: initial?.status ?? STATUSES[0] },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await onSave({ title: v.title.trim(), status: v.status, data: { units: Number(v.units.replace(/,/g, "")), targetDate: v.date, build: v.build.trim() } });
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="batch-name" label="Name" error={errors.title?.message}>
        <Input id="batch-name" autoFocus aria-invalid={!!errors.title} {...register("title")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="batch-units" label="Units" error={errors.units?.message}>
          <Input id="batch-units" inputMode="numeric" aria-invalid={!!errors.units} {...register("units")} />
        </Field>
        <Field id="batch-date" label="Target date">
          <Input id="batch-date" type="date" {...register("date")} />
        </Field>
      </div>
      <Field id="batch-build" label="Build it belongs to" hint="Name the build the way the acceptance tests do. Tests that name no build count for every build.">
        <Input id="batch-build" {...register("build")} />
      </Field>
      <Field id="batch-status" label="Status">
        <NativeSelect id="batch-status" {...register("status")}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
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
