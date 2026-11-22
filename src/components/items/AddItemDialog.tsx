"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Column } from "@/lib/menu";
import { ItemDialogShell } from "./ItemDialogShell";
import { describe, Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Draft = { title: string; body: string; status: string; data: Record<string, string> };

export function AddItemDialog({
  open,
  onOpenChange,
  label,
  sectionLabel,
  columns,
  statuses,
  onCreate,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  sectionLabel: string;
  columns: Column[];
  statuses: string[];
  onCreate: (d: { title: string; body: string; status: string; data: Record<string, string> }) => Promise<void>;
  returnFocus?: () => HTMLElement | null | undefined;
}) {
  return (
    <ItemDialogShell returnFocus={returnFocus} open={open} onOpenChange={onOpenChange} eyebrow={sectionLabel} title={label} description="A title is required. Everything else can be filled in later.">
      {open && <AddForm columns={columns} statuses={statuses} onCancel={() => onOpenChange(false)} onCreate={onCreate} />}
    </ItemDialogShell>
  );
}

const schema = z.object({
  title: z.string().refine((v) => v.trim() !== "", "Give it a title."),
  body: z.string(),
  status: z.string(),
  data: z.record(z.string(), z.string()),
});

function AddForm({ columns, statuses, onCancel, onCreate }: { columns: Column[]; statuses: string[]; onCancel: () => void; onCreate: (d: Draft) => Promise<void> }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting: busy } } = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "", status: statuses[0] ?? "open", data: Object.fromEntries(columns.map((c) => [c.key, ""])) },
  });

  const submit = handleSubmit(async (d) => {
    try {
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.data)) if (v.trim()) data[k] = v.trim();
      await onCreate({ ...d, title: d.title.trim(), body: d.body.trim(), data });
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 px-5 py-4" noValidate>
      <Field label="Title" id="add-title" error={errors.title?.message}>
        <Input id="add-title" autoFocus required aria-required {...describe("add-title", { error: errors.title?.message })} {...register("title")} />
      </Field>
      <Field label="Details" id="add-body">
        <Textarea id="add-body" rows={4} {...register("body")} />
      </Field>
      {columns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {columns.map((c) => (
            <Field key={c.key} label={c.label} id={`add-${c.key}`}>
              <Input id={`add-${c.key}`} {...register(`data.${c.key}`)} />
            </Field>
          ))}
        </div>
      )}
      <Field label="Status" id="add-status">
        <NativeSelect id="add-status" {...register("status")}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {errors.root?.message && (
        <p role="alert" className="text-sm text-danger">
          {errors.root.message}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding" : "Add"}
        </Button>
      </div>
    </form>
  );
}
