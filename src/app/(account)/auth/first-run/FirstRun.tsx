"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EYEBROW, Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { HeroStage } from "@/components/welcome/HeroStage";
import type { HeroFacts } from "@/components/welcome/storyData";
import type { Product } from "@/components/welcome/product/model";
import { call } from "@/lib/auth2/client";
import { useStoredTheme } from "../_components/Frame";
import { Message } from "../_components/Message";
import { MIN_PASSWORD, emailField, newPasswordField } from "../_components/rules";

const base = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep the name to 80 characters."),
  email: emailField,
  password: newPasswordField,
  confirm: z.string(),
  address: z.string().optional(),
  setupCode: z.string().trim().min(1, "Enter the set-up code from the server log.").max(40, "That is longer than a set-up code."),
});
type Values = z.infer<typeof base>;

/**
 * The first-run form beside a short introduction. `address` is shown (and must be confirmed) only when the install
 * has no base address yet; it is the address this page is open at.
 */
export function FirstRun({ email, address, idea, facts, product }: { email: string; address: string | null; idea: string; facts: HeroFacts; product: Product }) {
  useStoredTheme();
  const schema = base.refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords are not the same." });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email, password: "", confirm: "", address: address ?? undefined, setupCode: "" },
  });
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
          <p className="mt-1 text-sm text-secondary">This account administers the installation and gets a workspace of its own. It is ready at once: no confirmation email is needed. The set-up code proves you run this installation.</p>
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
            <Field id="fr-email" label="Email address" hint="The administrator's address. You can change it now; later only an administrator can." error={errors.email?.message}>
              <Input id="fr-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register("email")} {...describe("fr-email", { hint: true, error: errors.email?.message })} />
            </Field>
            <Field id="fr-password" label="Password" hint={`At least ${MIN_PASSWORD} characters. You choose it; it is never shown or sent anywhere.`} error={errors.password?.message}>
              <Input id="fr-password" type="password" autoComplete="new-password" {...register("password")} {...describe("fr-password", { hint: true, error: errors.password?.message })} />
            </Field>
            <Field id="fr-confirm" label="Password again" error={errors.confirm?.message}>
              <Input id="fr-confirm" type="password" autoComplete="new-password" {...register("confirm")} {...describe("fr-confirm", { error: errors.confirm?.message })} />
            </Field>
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
