"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import type { PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { NewPasswordFields } from "../_components/NewPasswordFields";
import { emailField, policyPasswordField } from "../_components/rules";

type Values = { name: string; email: string; password: string; confirm: string };

/** `mail` false is "no mail" mode: nothing is emailed and an administrator confirms the account. */
export function SignUpForm({ email = "", next = null, mail = true, policy }: { email?: string; next?: string | null; mail?: boolean; policy: PasswordPolicy }) {
  const router = useRouter();
  const schema = useMemo(
    () =>
      z
        .object({ name: z.string().trim().min(1, "Enter your name.").max(80, "Keep the name to 80 characters."), email: emailField, password: z.string(), confirm: z.string() })
        .superRefine((v, ctx) => {
          const r = policyPasswordField(policy, () => ({ email: v.email, name: v.name })).safeParse(v.password);
          if (!r.success) ctx.addIssue({ code: "custom", path: ["password"], message: r.error.issues[0]?.message ?? "" });
          if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords are not the same." });
        }),
    [policy]
  );
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email, password: "", confirm: "" },
  });
  const [pw, typedEmail, typedName] = useWatch({ control, name: ["password", "email", "name"] });

  const submit = handleSubmit(async (v) => {
    const r = await call("/sign-up/email", { name: v.name, email: v.email, password: v.password });
    if (!r.ok) return setError("root", { message: r.error });
    router.push(`/auth/check-email?email=${encodeURIComponent(v.email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  });

  return (
    <Frame
      title="Create an account"
      lead={mail ? "You get a workspace of your own. We send a link to confirm your email address." : "You get a workspace of your own. An administrator confirms new accounts before their first sign-in."}
      footer={<p>Already have an account? <TextLink href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}>Sign in</TextLink></p>}
    >
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Message id="sign-up-message" error={errors.root?.message} />
        <Field id="name" label="Your name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" autoFocus {...register("name")} {...describe("name", { error: errors.name?.message })} />
        </Field>
        <Field id="email" label="Email address" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register("email")} {...describe("email", { error: errors.email?.message })} />
        </Field>
        <NewPasswordFields register={register} errors={errors} policy={policy} value={pw} who={{ email: typedEmail, name: typedName }} label="Password" />
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Creating the account…" : "Create account"}</Button>
      </form>
    </Frame>
  );
}
