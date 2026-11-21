"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NetClass } from "@/lib/domain";
import { CLASSES, CLASS_LABEL, type Part } from "./model";
import { autoName, type WireDraft } from "./WireDialog";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";

const schema = z
  .object({ from: z.string(), to: z.string(), fromPin: z.string(), toPin: z.string(), net: z.string(), netClass: z.string() })
  .superRefine((v, ctx) => {
    if (!v.from || !v.to) return ctx.addIssue({ code: "custom", path: ["from"], message: "Pick a part at both ends." });
    if (!v.fromPin.trim() || !v.toPin.trim()) return ctx.addIssue({ code: "custom", path: [v.fromPin.trim() ? "toPin" : "fromPin"], message: "Type the pin name at both ends." });
    if (v.from === v.to && v.fromPin.trim() === v.toPin.trim()) ctx.addIssue({ code: "custom", path: ["toPin"], message: "A wire needs two different pins." });
  });
type Values = z.infer<typeof schema>;

/** The first wire, typed in: two parts, two pin names, a net. Works before anything is on the canvas. */
export function FirstConnection({ parts, nextOrder, onSave, onDone }: { parts: Part[]; nextOrder: number; onSave: (d: WireDraft) => Promise<void>; onDone?: () => void }) {
  const { register, handleSubmit, reset, getValues, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { from: parts[0]?.ref ?? "", to: parts[1]?.ref ?? parts[0]?.ref ?? "", fromPin: "", toPin: "", net: "", netClass: "signal" },
  });

  const submit = handleSubmit(async (v) => {
    const fp = v.fromPin.trim();
    const tp = v.toPin.trim();
    try {
      await onSave({ name: autoName({ from: v.from, fromPin: fp, to: v.to, toPin: tp }), net: v.net.trim(), netClass: v.netClass as NetClass, note: "", from: v.from, fromPin: fp, to: v.to, toPin: tp, order: nextOrder, status: "to solder" });
      reset({ ...getValues(), fromPin: "", toPin: "", net: "" });
      onDone?.();
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  const partSelect = (id: string, name: "from" | "to") => (
    <NativeSelect id={id} {...register(name)}>
      {parts.map((p) => (
        <option key={p.item.id} value={p.ref}>
          {p.ref} · {p.title}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field id="fc-from" label="From part" error={errors.from?.message}>{partSelect("fc-from", "from")}</Field>
        <Field id="fc-from-pin" label="From pin" error={errors.fromPin?.message}>
          <Input id="fc-from-pin" className="font-mono" placeholder="GND" aria-invalid={!!errors.fromPin} {...register("fromPin")} />
        </Field>
        <Field id="fc-to" label="To part">{partSelect("fc-to", "to")}</Field>
        <Field id="fc-to-pin" label="To pin" error={errors.toPin?.message}>
          <Input id="fc-to-pin" className="font-mono" placeholder="GND" aria-invalid={!!errors.toPin} {...register("toPin")} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field id="fc-net" label="Net">
          <Input id="fc-net" className="font-mono" placeholder="GND" {...register("net")} />
        </Field>
        <Field id="fc-class" label="Net class">
          <NativeSelect id="fc-class" {...register("netClass")}>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {CLASS_LABEL[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {errors.root?.message && <ErrorLine>{errors.root.message}</ErrorLine>}
      <Button type="submit" disabled={isSubmitting || !parts.length}>
        <Plus className="h-4 w-4" aria-hidden /> {isSubmitting ? "Adding" : "Add first connection"}
      </Button>
    </form>
  );
}
