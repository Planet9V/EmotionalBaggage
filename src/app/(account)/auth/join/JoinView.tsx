"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/auth2/client";
import type { JoinView as View } from "@/lib/auth2/accountInvitations";
import type { PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { NewPasswordFields } from "../_components/NewPasswordFields";
import { policyPasswordPair } from "../_components/rules";

const WHY = {
  expired: "This invitation has expired: an invitation works for a limited number of days after it is sent. Ask the administrator who invited you to send it again; the new email (or link) works at once.",
  used: "This invitation has been used already: your account exists. Sign in with the password you chose, or use \"Forgotten your password?\".",
  revoked: "This invitation was withdrawn. Ask the administrator who invited you for a new one.",
  invalid: "This invitation link is not valid. It may have been sent again since (only the newest link works), or copied only in part. Ask the administrator for a new one.",
} as const;

/** Every case of an account invitation link: choose a password, or say plainly why not and what to do. */
export function JoinView({ token, view, policy }: { token: string; view: View; policy: PasswordPolicy }) {
  const schema = useMemo(() => policyPasswordPair(policy, () => (view.state === "open" ? { email: view.email, name: view.name } : {})), [policy, view]);
  const { register, handleSubmit, setError, reset, control, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  const pw = useWatch({ control, name: "password" });
  if (view.state !== "open") {
    return (
      <Frame title="This invitation cannot be used" footer={<p><TextLink href="/auth/sign-in">Sign in</TextLink></p>}>
        <p className="text-sm text-primary" data-testid="join-why">{WHY[view.state]}</p>
      </Frame>
    );
  }
  const submit = handleSubmit(async (v) => {
    const r = await call<{ email: string }>("/account/join", { token, password: v.password });
    if (!r.ok) {
      reset({ password: "", confirm: "" });
      return setError("root", { message: r.error });
    }
    const s = await call("/sign-in/email", { email: view.email, password: v.password, rememberMe: true });
     
    window.location.assign(s.ok ? "/auth/account" : "/auth/sign-in");
  });
  return (
    <Frame title={`Welcome, ${view.name}`} lead={<>Choose a password for <strong className="break-all font-medium text-primary">{view.email}</strong>. Your account and a workspace of your own are ready.</>}>
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Message id="join-message" error={errors.root?.message} />
        <NewPasswordFields register={register} errors={errors} policy={policy} value={pw} who={{ email: view.email, name: view.name }} label="Password" />
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save and sign in"}</Button>
      </form>
    </Frame>
  );
}
