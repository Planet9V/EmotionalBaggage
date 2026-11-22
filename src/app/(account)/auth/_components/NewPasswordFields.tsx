"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD } from "./rules";

type Values = { password: string; confirm: string };

/** "New password" and "New password again", shared by the reset and change screens. */
export function NewPasswordFields<T extends Values>({ register, errors }: { register: UseFormRegister<T>; errors: FieldErrors<Values> }) {
  const reg = register as unknown as UseFormRegister<Values>;
  return (
    <>
      <Field id="new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={errors.password?.message}>
        <Input id="new-password" type="password" autoComplete="new-password" {...reg("password")} {...describe("new-password", { hint: true, error: errors.password?.message })} />
      </Field>
      <Field id="new-password-again" label="New password again" error={errors.confirm?.message}>
        <Input id="new-password-again" type="password" autoComplete="new-password" {...reg("confirm")} {...describe("new-password-again", { error: errors.confirm?.message })} />
      </Field>
    </>
  );
}
