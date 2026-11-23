"use client";

import { useRouter } from "next/navigation";
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
import { emailField, passwordField } from "../_components/rules";

const schema = z.object({ email: emailField, password: passwordField });
type Values = z.infer<typeof schema>;

/** Email and password. With an authenticator app on the account, the code is asked for next (/auth/two-factor). */
export function SignInForm({ next, setupPending = false }: { next: string; setupPending?: boolean }) {
  const [notSetUp, setNotSetUp] = useState(setupPending);
  const router = useRouter();
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (v) => {
    setUnconfirmed(null);
    const r = await call<{ twoFactorRedirect?: boolean }>("/sign-in/email", { email: v.email, password: v.password, rememberMe: true });
    if (!r.ok) {
      setValue("password", "");
      if (r.code === "EMAIL_NOT_VERIFIED") setUnconfirmed(v.email);
      if (r.code === "REENROL_PROOF_REQUIRED") return router.push(`/auth/re-enrol?email=${encodeURIComponent(v.email)}`);
      // A password an administrator set: choose your own first (no session starts before).
      if (r.code === "PASSWORD_CHANGE_REQUIRED") return router.push(`/auth/password/first?email=${encodeURIComponent(v.email)}`);
      if (r.code === "SETUP_REQUIRED") setNotSetUp(true);
      return setError("root", { message: r.error });
    }
    if (r.data?.twoFactorRedirect) return router.push(`/auth/two-factor?next=${encodeURIComponent(next)}`);
    // A full navigation, so every part of the page starts again signed in.
    window.location.assign(next);
  });

  return (
    <Frame
      title="Sign in"
      lead="With your email address and password."
      footer={
        <>
          <p><TextLink href="/auth/reset">Forgotten your password?</TextLink></p>
          <p>No account yet? <TextLink href="/auth/sign-up">Create one</TextLink></p>
        </>
      }
    >
      {/* method="post": if the script has not loaded, a native submit must not put the password in the address. */}
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        {notSetUp ? (
          <p role="note" className="rounded-md bg-info-soft px-3 py-2 text-sm text-info" data-testid="first-run-notice">
            This installation has no owner yet. <TextLink href="/auth/first-run">Create the owner on the first-run page</TextLink>; it asks for the set-up code printed in the server log.
          </p>
        ) : null}
        <Message id="sign-in-message" error={errors.root?.message} />
        {unconfirmed && (
          <p className="text-sm">
            <TextLink href={`/auth/check-email?email=${encodeURIComponent(unconfirmed)}`}>Send the confirmation link again</TextLink>
          </p>
        )}
        <Field id="email" label="Email address" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus {...register("email")} {...describe("email", { error: errors.email?.message })} />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} {...describe("password", { error: errors.password?.message })} />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
      </form>
    </Frame>
  );
}
