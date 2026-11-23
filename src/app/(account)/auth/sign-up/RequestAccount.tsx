"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { emailField } from "../_components/rules";

const schema = z.object({
  name: z.string().trim().max(120, "Keep your name under 120 characters."),
  email: emailField,
  building: z.string().trim().min(3, "Say in a few words what you want to make.").max(300, "Keep this under 300 characters."),
});
type Values = z.infer<typeof schema>;

/**
 * While self sign-up is closed (Admin, Sign-in; closed during early access): a request for an account. It is an
 * access request (Admin, Access requests) and is announced to the owner by email when mail is set up. People with an
 * invitation use its link instead.
 */
export function RequestAccount({ email = "" }: { email?: string }) {
  const [done, setDone] = useState("");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email, building: "" } });
  const submit = handleSubmit(async (v) => {
    let res: Response;
    try {
      res = await fetch("/api/access-requests", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ...v, placement: "signup" }) });
    } catch {
      return setError("root", { message: "The server could not be reached. Check your connection and try again." });
    }
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (!res.ok) return setError("root", { message: body.error ?? "That did not work. Try again in a moment." });
    setDone(body.message ?? "Your request is in. The administrator will be in touch.");
  });
  return (
    <Frame
      title="Ask for an account"
      lead="Accounts on this installation are made by invitation during early access. Tell us who you are and what you want to make; the administrator replies by email."
      footer={<><p>Already have an account? <TextLink href="/auth/sign-in">Sign in</TextLink></p><p>Invited? Use the link in your invitation email.</p></>}
    >
      {done ? (
        <Message id="request-done" done={done} />
      ) : (
        <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <Message id="request-message" error={errors.root?.message} />
          <Field id="req-name" label="Your name" error={errors.name?.message}>
            <Input id="req-name" autoComplete="name" {...register("name")} {...describe("req-name", { error: errors.name?.message })} />
          </Field>
          <Field id="req-email" label="Email address" error={errors.email?.message}>
            <Input id="req-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register("email")} {...describe("req-email", { error: errors.email?.message })} />
          </Field>
          <Field id="req-building" label="What do you want to make?" error={errors.building?.message}>
            <Textarea id="req-building" rows={3} {...register("building")} {...describe("req-building", { error: errors.building?.message })} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Ask for an account"}</Button>
        </form>
      )}
    </Frame>
  );
}
