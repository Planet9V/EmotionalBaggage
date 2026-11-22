"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { MIN_PASSWORD, emailField, newPasswordField } from "../_components/rules";

const schema = z
  .object({ name: z.string().trim().min(1, "Enter your name.").max(80, "Keep the name to 80 characters."), email: emailField, password: newPasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords are not the same." });
type Values = z.infer<typeof schema>;

/** `mail` false is "no mail" mode: nothing is emailed and an administrator confirms the account. */
export function SignUpForm({ email = "", next = null, mail = true }: { email?: string; next?: string | null; mail?: boolean }) {
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email, password: "", confirm: "" },
  });

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
        <Field id="password" label="Password" hint={`At least ${MIN_PASSWORD} characters.`} error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} {...describe("password", { hint: true, error: errors.password?.message })} />
        </Field>
        <Field id="confirm" label="Password again" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} {...describe("confirm", { error: errors.confirm?.message })} />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Creating the account…" : "Create account"}</Button>
      </form>
    </Frame>
  );
}
