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
/** `mail` false is "no mail" mode: no link can be sent, so the page says who resets a password instead. */
export function ResetRequest({ mail = true }: { mail?: boolean }) {
  const [sentTo, setSentTo] = useState("");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const submit = handleSubmit(async (v) => {
    // Without mail no link can be sent: the request is noted for the platform administrator instead.
    const r = await call(mail ? "/request-password-reset" : "/account/reset-request", { email: v.email });
    if (!r.ok) return setError("root", { message: r.error });
    setSentTo(v.email);
  });

  if (!mail) {
    return (
      <Frame title="Reset your password" footer={<p><TextLink href="/auth/sign-in">Back to sign in</TextLink></p>}>
        <p role="note" className="text-sm text-primary">Reset by email is not available on this installation yet: no mail is set up. Ask the administrator of this installation to set a temporary password for you.</p>
        {sentTo ? (
          <Message id="reset-done" done={`Noted. If ${sentTo} has an account here, the administrator sees that you asked for a reset.`} />
        ) : (
          <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
            <Message id="reset-message" error={errors.root?.message} />
            <Field id="email" label="Email address" hint="To let the administrator know you asked." error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} autoFocus {...register("email")} {...describe("email", { hint: true, error: errors.email?.message })} />
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Tell the administrator"}</Button>
          </form>
        )}
      </Frame>
    );
  }
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
