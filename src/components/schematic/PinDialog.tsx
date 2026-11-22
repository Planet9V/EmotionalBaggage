"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine } from "@/components/ui/states";
import { describe, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

const PIN_ID = "pin-dialog-name";

const pinSchema = (existing: string[]) =>
  z.object({
    pin: z
      .string()
      .trim()
      .min(1, "Type a pin name, as printed on the board or in the datasheet.")
      .superRefine((name, ctx) => {
        if (existing.includes(name)) ctx.addIssue({ code: "custom", message: `This part already has a pin called ${name}.` });
      }),
  });
type Values = z.infer<ReturnType<typeof pinSchema>>;

/** Name one pin: used for "Add pin" on a node and for the first pin of a part placed from the palette. */
export function PinDialog({
  title,
  description,
  existing,
  submitLabel,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  existing: string[];
  submitLabel: string;
  onClose: () => void;
  onSave: (pin: string) => Promise<void>;
}) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(pinSchema(existing)),
    defaultValues: { pin: "" },
  });
  const hint = existing.length ? `Pins so far: ${existing.join(", ")}` : undefined;

  const submit = handleSubmit(async ({ pin }) => {
    try {
      await onSave(pin);
      onClose();
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={title} description={description} width="420px">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <Field id={PIN_ID} label="Pin name" hint={hint} error={errors.pin?.message}>
          <Input id={PIN_ID} autoFocus className="font-mono" placeholder="GPIO5" {...describe(PIN_ID, { hint: !!hint, error: errors.pin?.message })} {...register("pin")} />
        </Field>
        {errors.root?.message ? <ErrorLine>{errors.root.message}</ErrorLine> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
