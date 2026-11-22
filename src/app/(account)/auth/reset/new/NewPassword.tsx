"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../../_components/Frame";
import { Message } from "../../_components/Message";
import { NewPasswordFields } from "../../_components/NewPasswordFields";
import { newPasswordPair } from "../../_components/rules";

type Values = z.infer<typeof newPasswordPair>;

/** The page the reset email links to: choose the new password. The link works once. */
export function NewPassword({ token }: { token: string | null }) {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(newPasswordPair), defaultValues: { password: "", confirm: "" } });

  const submit = handleSubmit(async (v) => {
    const r = await call("/reset-password", { token, newPassword: v.password });
    if (!r.ok) {
      reset({ password: "", confirm: "" });
      return setError("root", { message: r.error });
    }
    setDone(true);
  });

  if (!token) {
    return (
      <Frame title="Choose a new password" footer={<p><TextLink href="/auth/reset">Ask for a new link</TextLink></p>}>
        <Message id="new-password-message" error="This link is not complete. Open the link from the email again, or copy all of it." />
      </Frame>
    );
  }

  return (
    <Frame title="Choose a new password" footer={<p><TextLink href={done ? "/auth/sign-in" : "/auth/reset"}>{done ? "Sign in" : "Ask for a new link"}</TextLink></p>}>
      {done ? (
        <Message id="new-password-done" done="Your password is changed. Every browser signed in to this account was signed out. Sign in with the new password." />
      ) : (
        <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <Message id="new-password-message" error={errors.root?.message} />
          <NewPasswordFields register={register} errors={errors} />
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save the new password"}</Button>
        </form>
      )}
    </Frame>
  );
}
