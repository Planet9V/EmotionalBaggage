"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import type { PasswordOwner, PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { NewPasswordFields } from "../_components/NewPasswordFields";
import { passwordField, policyPasswordPair } from "../_components/rules";

type Values = { current: string; password: string; confirm: string };

/** Change the password with the current one; every other browser signed in to the account is signed out. */
export function ChangePassword({ policy, who }: { policy: PasswordPolicy; who: PasswordOwner }) {
  const [done, setDone] = useState(false);
  const schema = useMemo(() => z.object({ current: passwordField }).and(policyPasswordPair(policy, () => who)), [policy, who]);
  const { register, handleSubmit, setError, reset, control, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current: "", password: "", confirm: "" } });
  const pw = useWatch({ control, name: "password" });

  const submit = handleSubmit(async (v) => {
    setDone(false);
    const r = await call("/change-password", { currentPassword: v.current, newPassword: v.password, revokeOtherSessions: true });
    if (!r.ok) {
      if (r.code === "INVALID_PASSWORD") {
        reset({ current: "", password: v.password, confirm: v.confirm });
        return setError("current", { message: r.error });
      }
      return setError("root", { message: r.error });
    }
    reset({ current: "", password: "", confirm: "" });
    setDone(true);
  });

  return (
    <Frame title="Change your password" footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}>
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Message id="change-message" error={errors.root?.message} done={done ? "The password is changed. Every other browser signed in to this account was signed out." : undefined} />
        <Field id="current" label="Current password" error={errors.current?.message}>
          <Input id="current" type="password" autoComplete="current-password" autoFocus {...register("current")} {...describe("current", { error: errors.current?.message })} />
        </Field>
        <NewPasswordFields register={register} errors={errors} policy={policy} value={pw} who={who} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Changing…" : "Change password"}</Button>
      </form>
    </Frame>
  );
}
