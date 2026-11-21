"use client";

// "Request your own workspace": a real form, stored in PostgreSQL by POST /api/access-requests. The same zod
// schema checks it here and on the server. No email is sent; the confirmation says so.
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, describe } from "@/components/ui/field";
import { SaveError } from "@/components/ui/states";
import { useSendAccessRequest } from "@/lib/accessRequests/client";
import { ACCESS_LIMITS, AccessRequestForm as Schema, type AccessRequestValues } from "@/lib/accessRequests/shared";
import { messageOf } from "@/lib/queries";

const EMPTY: AccessRequestValues = { name: "", email: "", building: "", company: "", website: "" };

export function AccessRequestForm() {
  const send = useSendAccessRequest();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccessRequestValues>({ resolver: zodResolver(Schema), defaultValues: EMPTY, mode: "onSubmit", reValidateMode: "onChange" });

  const submit = handleSubmit(async (v) => {
    try {
      await send.mutateAsync(v);
    } catch (e) {
      setError("root", { message: messageOf(e) });
    }
  });

  if (send.isSuccess) {
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-hairline bg-surface p-6">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-base font-semibold text-primary">Request received</p>
          <p className="mt-1 text-sm text-secondary">{send.data}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="request-title" className="relative grid gap-4 rounded-xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="req-name" label="Your name" required error={errors.name?.message}>
          <Input id="req-name" autoComplete="name" maxLength={ACCESS_LIMITS.name} {...describe("req-name", { error: errors.name?.message })} {...register("name")} />
        </Field>
        <Field id="req-email" label="Email" required error={errors.email?.message} hint="Only to reply to this request.">
          <Input id="req-email" type="email" autoComplete="email" maxLength={ACCESS_LIMITS.email} {...describe("req-email", { hint: true, error: errors.email?.message })} {...register("email")} />
        </Field>
      </div>
      <Field id="req-building" label="What do you want to build?" required error={errors.building?.message} hint="A sentence or two is plenty.">
        <Textarea id="req-building" rows={4} maxLength={ACCESS_LIMITS.building} {...describe("req-building", { hint: true, error: errors.building?.message })} {...register("building")} />
      </Field>
      <Field id="req-company" label="Company (optional)" error={errors.company?.message}>
        <Input id="req-company" autoComplete="organization" maxLength={ACCESS_LIMITS.company} {...describe("req-company", { error: errors.company?.message })} {...register("company")} />
      </Field>
      {/* A honeypot: hidden from people and out of the tab order. Scripts that fill every box fill this one too. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="req-website">Leave this field empty</label>
        <input id="req-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      {errors.root?.message ? <SaveError message={errors.root.message} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Request a workspace"}
        </Button>
        <p className="text-xs text-muted">Stored in this install&apos;s database. No email is sent by the app.</p>
      </div>
    </form>
  );
}
