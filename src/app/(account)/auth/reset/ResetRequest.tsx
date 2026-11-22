"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { emailField } from "../_components/rules";

const schema = z.object({ email: emailField });

/** Asks for a reset link. The answer is the same whether or not the address has an account. */
export function ResetRequest() {
  const [sentTo, setSentTo] = useState("");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const submit = handleSubmit(async (v) => {
    const r = await call("/request-password-reset", { email: v.email });
    if (!r.ok) return setError("root", { message: r.error });
    setSentTo(v.email);
  });

  return (
    <Frame title="Reset your password" lead="We email you a link to choose a new one." footer={<p><TextLink href="/auth/sign-in">Back to sign in</TextLink></p>}>
      {sentTo ? (
        <Message id="reset-done" done={`If ${sentTo} has an account here, a link is on its way. It works once, for one hour.`} />
      ) : (
        <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <Message id="reset-message" error={errors.root?.message} />
          <Field id="email" label="Email address" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} autoFocus {...register("email")} {...describe("email", { error: errors.email?.message })} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send the link"}</Button>
        </form>
      )}
    </Frame>
  );
}
