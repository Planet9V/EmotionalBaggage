"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { policySummary, type PasswordOwner, type PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import { PasswordChecklist } from "./PasswordChecklist";

type Values = { password: string; confirm: string };

/**
 * "New password" and "New password again", shared by every screen where a password is chosen, with the rules in
 * force listed under the field and ticked off live (`value` is the field's current text, from the form's watch).
 */
export function NewPasswordFields<T extends Values>({
  register,
  errors,
  policy,
  value,
  who,
  label = "New password",
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<Values>;
  policy: PasswordPolicy;
  value: string;
  who?: PasswordOwner;
  label?: string;
}) {
  const reg = register as unknown as UseFormRegister<Values>;
  return (
    <>
      <Field id="new-password" label={label} hint={policySummary(policy)} error={errors.password?.message}>
        <Input id="new-password" type="password" autoComplete="new-password" {...reg("password")} {...describe("new-password", { hint: true, error: errors.password?.message })} aria-describedby={`new-password-hint new-password-rules${errors.password?.message ? " new-password-error" : ""}`} />
      </Field>
      <PasswordChecklist id="new-password-rules" policy={policy} value={value} who={who} />
      <Field id="new-password-again" label={`${label} again`} error={errors.confirm?.message}>
        <Input id="new-password-again" type="password" autoComplete="new-password" {...reg("confirm")} {...describe("new-password-again", { error: errors.confirm?.message })} />
      </Field>
    </>
  );
}
