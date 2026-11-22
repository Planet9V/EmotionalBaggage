"use client";

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

/**
 * With the emailed link (`token`) only the address and password are asked; without it, also the one-time code the
 * person who reset it handed over. Then the password signs in for a short while, straight to setting up the app.
 */
export function Reenrol({ token, email }: { token: string | null; email: string }) {
  const schema = z.object({
    email: emailField,
    password: passwordField,
    code: token ? z.string().optional() : z.string().trim().min(1, "Enter the code you were given.").max(40, "That is longer than a code."),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email, password: "", code: "" } });
  const submit = handleSubmit(async (v) => {
    const proved = await call("/re-enrol", { email: v.email, password: v.password, proof: token ?? v.code ?? "" });
    if (!proved.ok) {
      setValue("password", "");
      return setError("root", { message: proved.error });
    }
    const signed = await call("/sign-in/email", { email: v.email, password: v.password, rememberMe: true });
    if (!signed.ok) return setError("root", { message: signed.error });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, signed in
    window.location.assign("/auth/two-factor/setup");
  });
  return (
    <Frame
      title="Set up two-step sign-in again"
      lead={token ? "Your two-step sign-in was reset. Enter your address and password to set up an authenticator app again." : "Your two-step sign-in was reset. Enter your address, your password and the code you were given."}
      footer={<p><TextLink href="/auth/sign-in">Back to sign in</TextLink></p>}
    >
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Message id="reenrol-message" error={errors.root?.message} />
        <Field id="email" label="Email address" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("email")} {...describe("email", { error: errors.email?.message })} />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} {...describe("password", { error: errors.password?.message })} />
        </Field>
        {!token && (
          <Field id="code" label="Code" hint="From the owner or administrator who reset your two-step sign-in." error={errors.code?.message}>
            <Input id="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono tracking-widest" {...register("code")} {...describe("code", { hint: true, error: errors.code?.message })} />
          </Field>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Checking…" : "Continue"}</Button>
      </form>
    </Frame>
  );
}
