"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPublicUrl } from "@/lib/economics/schemas";
import type { Item } from "@/lib/types";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";

export type ComplianceDraft = { title: string; data: { why: string; check: string; evidence: string } };

export function ComplianceDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: Item | null; onSave: (v: ComplianceDraft) => Promise<void> }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Edit compliance row" : "Add compliance row"} description="A topic for your own checking. Not advice.">
      {open ? <Form key={initial?.id ?? "new"} initial={initial ?? null} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
    </Modal>
  );
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

const schema = z.object({
  title: z.string().trim().min(1, "Name the topic, for example: Radio equipment: FCC Part 15 in the US, RED in the EU."),
  why: z.string(),
  check: z.string(),
  evidence: z.string().refine((v) => !v.trim() || isPublicUrl(v.trim()), "Evidence: enter a public web address starting with http:// or https://."),
});
type Values = z.infer<typeof schema>;

function Form({ initial, onCancel, onSave }: { initial: Item | null; onCancel: () => void; onSave: (v: ComplianceDraft) => Promise<void> }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: initial?.title ?? "", why: text(initial?.data.why), check: text(initial?.data.check), evidence: text(initial?.data.evidence) },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await onSave({ title: v.title.trim(), data: { why: v.why.trim(), check: v.check.trim(), evidence: v.evidence.trim() } });
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="comp-topic" label="Topic" error={errors.title?.message}>
        <Input id="comp-topic" autoFocus aria-invalid={!!errors.title} {...register("title")} />
      </Field>
      <Field id="comp-why" label="Why it may apply" hint="Name the part or the claim that triggers it.">
        <Textarea id="comp-why" rows={3} {...register("why")} />
      </Field>
      <Field id="comp-check" label="What to check">
        <Textarea id="comp-check" rows={3} {...register("check")} />
      </Field>
      <Field id="comp-evidence" label="Evidence web address" hint="Where the evidence can be seen. A public address only." error={errors.evidence?.message}>
        <Input id="comp-evidence" inputMode="url" aria-invalid={!!errors.evidence} {...register("evidence")} />
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
