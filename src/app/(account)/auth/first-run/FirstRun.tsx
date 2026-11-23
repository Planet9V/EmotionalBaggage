"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EYEBROW, Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { HeroStage } from "@/components/welcome/HeroStage";
import type { HeroFacts } from "@/components/welcome/storyData";
import type { Product } from "@/components/welcome/product/model";
import { call } from "@/lib/auth2/client";
import type { PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import { useStoredTheme } from "../_components/Frame";
import { Message } from "../_components/Message";
import { NewPasswordFields } from "../_components/NewPasswordFields";
import { emailField, policyPasswordField } from "../_components/rules";

const base = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep the name to 80 characters."),
  email: emailField,
  password: z.string(),
  confirm: z.string(),
  address: z.string().optional(),
  setupCode: z.string().trim().min(1, "Enter the set-up code from the server log.").max(40, "That is longer than a set-up code."),
});
type Values = z.infer<typeof base>;

/**
 * The first-run form beside a short introduction. `address` is shown (and must be confirmed) only when the install
 * has no base address yet; it is the address this page is open at.
 */
export function FirstRun({ email, address, idea, facts, product, policy }: { email: string; address: string | null; idea: string; facts: HeroFacts; product: Product; policy: PasswordPolicy }) {
  useStoredTheme();
  const schema = useMemo(
    () =>
      base.superRefine((v, ctx) => {
        const r = policyPasswordField(policy, () => ({ email: v.email, name: v.name })).safeParse(v.password);
        if (!r.success) ctx.addIssue({ code: "custom", path: ["password"], message: r.error.issues[0]?.message ?? "" });
        if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords are not the same." });
      }),
    [policy]
  );
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email, password: "", confirm: "", address: address ?? undefined, setupCode: "" },
  });
  const [pw, typedEmail, typedName] = useWatch({ control, name: ["password", "email", "name"] });
  const submit = handleSubmit(async (v) => {
    const r = await call("/first-run/owner", { name: v.name, email: v.email, password: v.password, setupCode: v.setupCode, ...(address ? { address: v.address } : {}) });
    if (!r.ok) return setError("root", { message: r.error });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, signed in
    window.location.assign("/auth/account");
  });

  return (
    <main className="min-h-dvh bg-canvas px-4 py-10 text-primary">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="intro-h" className="min-w-0 space-y-4">
          <p className={EYEBROW}>Concept to realization</p>
          <h1 id="intro-h" className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Welcome to your own installation</h1>
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-secondary">
            It takes a product from a one-line idea to something on sale: AI drafts each stage from the last, and you decide at every step.
            Below is the worked example that ships with it. First, create the owner: the account that runs this installation.
          </p>
          {/* the hero's picture is lit for a dark ground, as on the welcome page */}
          <div className="dark overflow-hidden rounded-2xl border border-hairline bg-canvas p-5 text-primary sm:p-6">
            <HeroStage idea={idea} facts={facts} product={product} />
          </div>
        </section>
        <section aria-labelledby="owner-h" className="rounded-xl border border-hairline bg-surface p-5">
          <h2 id="owner-h" className="text-lg font-semibold tracking-tight text-primary">Create the owner</h2>
          <p role="note" className="mt-2 rounded-md bg-info-soft px-3 py-2 text-sm text-info" data-testid="setup-code-where">
            <strong className="font-semibold">Where is the set-up code?</strong> It is printed in the server log when the app starts; it is not emailed. With Docker: <code className="font-mono">docker compose logs web</code>; on Railway, the service&rsquo;s deploy logs.
          </p>
          <p className="mt-2 text-sm text-secondary">This account is the platform administrator: it administers the installation and gets a workspace of its own. It is ready at once: no confirmation email is needed. The set-up code proves you run this installation.</p>
          <form method="post" onSubmit={(e) => void submit(e)} noValidate className="mt-4 space-y-4">
            <Message id="first-run-message" error={errors.root?.message} />
            <Field
              id="fr-code"
              label="Set-up code"
              hint={<>Printed in the server log when the app started, on the line beginning &ldquo;[auth2] This installation has no owner yet&rdquo;. With Docker: <code className="font-mono">docker compose logs web</code>.</>}
              error={errors.setupCode?.message}
            >
              <Input id="fr-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono tracking-widest" {...register("setupCode")} {...describe("fr-code", { hint: true, error: errors.setupCode?.message })} />
            </Field>
            <Field id="fr-name" label="Your name" error={errors.name?.message}>
              <Input id="fr-name" autoComplete="name" autoFocus {...register("name")} {...describe("fr-name", { error: errors.name?.message })} />
            </Field>
            <Field id="fr-email" label="Email address" hint="Your own address: you become the platform administrator." error={errors.email?.message}>
              <Input id="fr-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register("email")} {...describe("fr-email", { hint: true, error: errors.email?.message })} />
            </Field>
            <NewPasswordFields register={register} errors={errors} policy={policy} value={pw} who={{ email: typedEmail, name: typedName }} label="Password" />
            {address && (
              <Field id="fr-address" label="Address of this installation" hint="The address people open it at; links in emails point here. It must be the address this page is open at." error={errors.address?.message}>
                <Input id="fr-address" type="url" autoCapitalize="none" spellCheck={false} {...register("address")} {...describe("fr-address", { hint: true, error: errors.address?.message })} />
              </Field>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Creating the owner…" : "Create the owner"}</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
