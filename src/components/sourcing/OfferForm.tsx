"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newId, offerSchema, type Offer } from "@/lib/sourcing/schemas";
import { ErrorLine } from "@/components/ui/states";
import { describe, Field } from "@/components/ui/field";
import { todayUtc } from "@/lib/format";

/** What the user typed, as text. The offer's own schema checks it, so the form and the stored offer can never disagree. */
const typed = z
  .object({ supplier: z.string(), partNumber: z.string(), url: z.string(), price: z.string(), packSize: z.string(), stock: z.string(), leadTimeDays: z.string(), checkedAt: z.string() })
  .transform((v): unknown => ({
    id: newId("o"),
    supplier: v.supplier.trim(),
    partNumber: v.partNumber.trim(),
    url: v.url.trim(),
    price: v.price,
    packSize: v.packSize || "1",
    stock: v.stock.trim(),
    leadTimeDays: v.leadTimeDays === "" ? undefined : v.leadTimeDays,
    checkedAt: v.checkedAt,
    source: "entered" as const,
  }))
  .pipe(offerSchema);

const blank = () => ({ supplier: "", partNumber: "", url: "", price: "", packSize: "1", stock: "", leadTimeDays: "", checkedAt: todayUtc() });

/** Adds one offer the user typed. A price the user typed is theirs; one from research arrives as a draft instead. */
export function OfferForm({ label, onAdd }: { label: string; onAdd: (o: Offer) => Promise<unknown> }) {
  const uid = useId();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<z.input<typeof typed>, unknown, Offer>({ resolver: zodResolver(typed), defaultValues: blank() });
  const id = (k: string) => `${uid}-${k}`;
  const field = (k: keyof z.input<typeof typed>) => ({ id: id(k), ...describe(id(k), { error: errors[k]?.message }), ...register(k) });

  const submit = handleSubmit(async (offer) => {
    try {
      await onAdd(offer);
      reset({ ...blank(), checkedAt: offer.checkedAt });
    } catch (x) {
      setError("root", { message: (x as Error).message });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-2 rounded-lg border border-hairline bg-subtle p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={`Add an offer for ${label}`}>
      <Field id={id("supplier")} label="Supplier" error={errors.supplier?.message}><Input maxLength={120} {...field("supplier")} /></Field>
      <Field id={id("price")} label="Price of one pack" error={errors.price?.message}><Input inputMode="decimal" {...field("price")} /></Field>
      <Field id={id("packSize")} label="Pieces in the pack" error={errors.packSize?.message}><Input inputMode="numeric" {...field("packSize")} /></Field>
      <Field id={id("leadTimeDays")} label="Lead time, days" error={errors.leadTimeDays?.message}><Input inputMode="numeric" {...field("leadTimeDays")} /></Field>
      <Field id={id("partNumber")} label="Part number" error={errors.partNumber?.message}><Input maxLength={120} {...field("partNumber")} /></Field>
      <Field id={id("url")} label="Product page" error={errors.url?.message}><Input placeholder="https://" maxLength={600} {...field("url")} /></Field>
      <Field id={id("stock")} label="Stock note" error={errors.stock?.message}><Input maxLength={200} {...field("stock")} /></Field>
      <Field id={id("checkedAt")} label="Price checked on" error={errors.checkedAt?.message}><Input type="date" {...field("checkedAt")} /></Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Saving" : "Add offer"}</Button>
        {errors.root?.message ? <ErrorLine>{errors.root.message}</ErrorLine> : null}
      </div>
    </form>
  );
}
