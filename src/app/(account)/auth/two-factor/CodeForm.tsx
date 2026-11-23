"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";
import { codeField } from "../_components/rules";

const codeSchema = z.object({ code: codeField });
const recoverySchema = z.object({ code: z.string().trim().min(1, "Enter one of your recovery codes.").max(40, "That is longer than a recovery code.") });
type Values = { code: string };

/** The second step of sign-in: the code from the authenticator app, or one recovery code. */
export function CodeForm({ next }: { next: string }) {
  const [recovery, setRecovery] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(recovery ? recoverySchema : codeSchema),
    defaultValues: { code: "" },
  });

  const submit = handleSubmit(async (v) => {
    const r = await call(recovery ? "/two-factor/verify-backup-code" : "/two-factor/verify-totp", { code: v.code });
    if (!r.ok) {
      reset({ code: "" });
      return setError("root", { message: r.error });
    }
    window.location.assign(next);
  });

  const toggle = () => {
    setRecovery((x) => !x);
    reset({ code: "" });
  };

  return (
    <Frame
      title={recovery ? "Use a recovery code" : "Enter your code"}
      lead={recovery ? "Each of the recovery codes you saved works once." : "Open your authenticator app and enter the six digits it shows for Shipwright."}
      footer={<p><TextLink href="/auth/sign-in">Start again</TextLink></p>}
    >
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Message id="code-message" error={errors.root?.message} />
        <Field id="code" label={recovery ? "Recovery code" : "Code"} error={errors.code?.message}>
          <Input
            id="code"
            key={recovery ? "recovery" : "code"}
            autoComplete="one-time-code"
            inputMode={recovery ? "text" : "numeric"}
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className="font-mono tracking-widest"
            {...register("code")}
            {...describe("code", { error: errors.code?.message })}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Checking…" : "Continue"}</Button>
        <Button type="button" variant="link" className="w-full" onClick={toggle}>
          {recovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
        </Button>
      </form>
    </Frame>
  );
}
