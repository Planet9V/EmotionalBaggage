"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import type { PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import { Frame, TextLink } from "../../_components/Frame";
import { Message } from "../../_components/Message";
import { NewPasswordFields } from "../../_components/NewPasswordFields";
import { emailField, passwordField, policyPasswordField } from "../../_components/rules";

type Values = { email: string; current: string; password: string; confirm: string };

/** The temporary password an administrator set, then a password of the person's own; then signed in. */
export function FirstPassword({ email, policy }: { email: string; policy: PasswordPolicy }) {
  const schema = useMemo(
    () =>
      z.object({ email: emailField, current: passwordField, password: z.string(), confirm: z.string() }).superRefine((v, ctx) => {
        const r = policyPasswordField(policy, () => ({ email: v.email })).safeParse(v.password);
        if (!r.success) ctx.addIssue({ code: "custom", path: ["password"], message: r.error.issues[0]?.message ?? "" });
        if (v.password === v.current) ctx.addIssue({ code: "custom", path: ["password"], message: "Choose a password other than the temporary one." });
        if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two new passwords are not the same." });
      }),
    [policy]
  );
  const { register, handleSubmit, setError, reset, control, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email, current: "", password: "", confirm: "" } });
  const [pw, typed] = useWatch({ control, name: ["password", "email"] });
  const submit = handleSubmit(async (v) => {
    const r = await call("/account/first-password", { email: v.email, password: v.current, newPassword: v.password });
    if (!r.ok) {
      reset({ email: v.email, current: "", password: "", confirm: "" });
      return setError("root", { message: r.error });
    }
    const s = await call("/sign-in/email", { email: v.email, password: v.password, rememberMe: true });
     
    window.location.assign(s.ok ? "/auth/account" : "/auth/sign-in");
  });
  return (
    <Frame title="Choose your password" lead="An administrator set a temporary password for your account. Choose one of your own to sign in." footer={<p><TextLink href="/auth/sign-in">Back to sign in</TextLink></p>}>
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Message id="first-password-message" error={errors.root?.message} />
        <Field id="fp-email" label="Email address" error={errors.email?.message}>
          <Input id="fp-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("email")} {...describe("fp-email", { error: errors.email?.message })} />
        </Field>
        <Field id="fp-current" label="Temporary password" error={errors.current?.message}>
          <Input id="fp-current" type="password" autoComplete="current-password" autoFocus {...register("current")} {...describe("fp-current", { error: errors.current?.message })} />
        </Field>
        <NewPasswordFields register={register} errors={errors} policy={policy} value={pw} who={{ email: typed }} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save and sign in"}</Button>
      </form>
    </Frame>
  );
}
