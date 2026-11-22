"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EYEBROW, Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../../_components/Frame";
import { Message } from "../../_components/Message";
import { codeField, passwordField } from "../../_components/rules";

const passwordSchema = z.object({ password: passwordField });
const codeSchema = z.object({ code: codeField });

type Started = { totpURI: string; backupCodes: string[] };

/** The secret in an otpauth:// address, in groups of four for typing into an app by hand. */
const secretOf = (uri: string) => (new URL(uri).searchParams.get("secret") ?? "").replace(/(.{4})/g, "$1 ").trim();

/** Asks for the password before a change to two-step sign-in. */
function PasswordStep({ id, label, action, busyLabel, onPassword }: { id: string; label: string; action: string; busyLabel: string; onPassword: (password: string) => Promise<string | null> }) {
  const { register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(passwordSchema), defaultValues: { password: "" } });
  const submit = handleSubmit(async (v) => {
    const problem = await onPassword(v.password);
    if (problem) {
      setValue("password", "");
      setError("root", { message: problem });
    }
  });
  return (
    <form method="post" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <Message id={`${id}-message`} error={errors.root?.message} />
      <Field id={id} label={label} error={errors.password?.message}>
        <Input id={id} type="password" autoComplete="current-password" {...register("password")} {...describe(id, { error: errors.password?.message })} />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? busyLabel : action}</Button>
    </form>
  );
}

/** The ten recovery codes, once: a list to copy or download, with a plain warning that they are shown only now. */
function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState("");
  const text = codes.join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("The codes are copied.");
    } catch {
      setCopied("The codes could not be copied here. Select them and copy them, or download them.");
    }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`Concept to Realization recovery codes. Each works once.\n\n${text}\n`], { type: "text/plain" }));
    a.download = "recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section aria-labelledby="codes-h" className="space-y-2">
      <h2 id="codes-h" className={EYEBROW}>Recovery codes</h2>
      <p className="text-sm text-primary">If you lose your phone, each of these lets you sign in once. Keep them somewhere safe: they are shown only now.</p>
      <ol aria-label="Recovery codes" className="grid grid-cols-2 gap-1 rounded-md border border-hairline bg-canvas p-3 font-mono text-sm text-primary">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>Copy</Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>Download</Button>
      </div>
      {copied && <p role="status" className="text-xs text-secondary">{copied}</p>}
    </section>
  );
}

function Enrol({ email }: { email: string }) {
  const [started, setStarted] = useState<Started | null>(null);
  const [qr, setQr] = useState("");
  const [on, setOn] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<{ code: string }>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });

  useEffect(() => {
    if (!started) return;
    let live = true;
    QRCode.toDataURL(started.totpURI, { margin: 1, width: 192 }).then((u) => live && setQr(u), () => live && setQr(""));
    return () => {
      live = false;
    };
  }, [started]);

  const begin = async (password: string) => {
    const r = await call<Started>("/two-factor/enable", { password });
    if (!r.ok) return r.error;
    setStarted(r.data);
    return null;
  };

  const confirm = handleSubmit(async (v) => {
    const r = await call("/two-factor/verify-totp", { code: v.code });
    if (!r.ok) {
      reset({ code: "" });
      return setError("root", { message: r.error });
    }
    setOn(true);
  });

  if (on) {
    return (
      <Frame title="Two-step sign-in is on" footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}>
        <Message id="setup-done" done="From now on, signing in asks for a code from your authenticator app after your password." />
      </Frame>
    );
  }

  if (!started) {
    return (
      <Frame title="Set up an authenticator app" lead="After your password, signing in will also ask for a six-digit code from an app on your phone." footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}>
        <PasswordStep id="password" label="Your password" action="Continue" busyLabel="Checking…" onPassword={begin} />
      </Frame>
    );
  }

  return (
    <Frame title="Set up an authenticator app" footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}>
      <section aria-labelledby="scan-h" className="space-y-2">
        <h2 id="scan-h" className={EYEBROW}>1. Add this account to the app</h2>
        <p className="text-sm text-primary">In your authenticator app, add an account and scan this code.</p>
        {qr ? (
          // A data: address made in this browser; next/image would add nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} width={192} height={192} alt={`QR code that adds ${email} on Concept to Realization to an authenticator app`} className="rounded-md bg-white p-1" />
        ) : (
          <p role="status" className="text-sm text-secondary">Drawing the QR code…</p>
        )}
        <p className="text-sm text-secondary">Cannot scan? Type this key into the app instead:</p>
        <p className="break-all font-mono text-sm text-primary" data-totp-key>{secretOf(started.totpURI)}</p>
      </section>
      <RecoveryCodes codes={started.backupCodes} />
      <form method="post" onSubmit={(e) => void confirm(e)} noValidate className="space-y-4" aria-labelledby="confirm-h">
        <h2 id="confirm-h" className={EYEBROW}>2. Enter the code the app shows</h2>
        <Message id="confirm-message" error={errors.root?.message} />
        <Field id="code" label="Code" error={errors.code?.message}>
          <Input id="code" autoComplete="one-time-code" inputMode="numeric" className="font-mono tracking-widest" {...register("code")} {...describe("code", { error: errors.code?.message })} />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Checking…" : "Turn on two-step sign-in"}</Button>
      </form>
    </Frame>
  );
}

function Manage() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [off, setOff] = useState(false);

  const fresh = async (password: string) => {
    const r = await call<{ backupCodes: string[] }>("/two-factor/generate-backup-codes", { password });
    if (!r.ok) return r.error;
    setCodes(r.data.backupCodes);
    return null;
  };
  const turnOff = async (password: string) => {
    const r = await call("/two-factor/disable", { password });
    if (!r.ok) return r.error;
    setOff(true);
    return null;
  };

  if (off) {
    return (
      <Frame title="Two-step sign-in is off" footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}>
        <Message id="off-done" done="Signing in now asks only for your password. You can remove this account from your authenticator app." />
      </Frame>
    );
  }

  return (
    <Frame title="Authenticator app" lead="Two-step sign-in is on." footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}>
      <section aria-labelledby="new-h" className="space-y-3">
        <h2 id="new-h" className={EYEBROW}>New recovery codes</h2>
        {codes ? (
          <RecoveryCodes codes={codes} />
        ) : (
          <>
            <p className="text-sm text-primary">Makes ten new codes. The old ones stop working.</p>
            <PasswordStep id="password-codes" label="Your password" action="Make new recovery codes" busyLabel="Making codes…" onPassword={fresh} />
          </>
        )}
      </section>
      <section aria-labelledby="off-h" className="space-y-3 border-t border-hairline pt-4">
        <h2 id="off-h" className={EYEBROW}>Turn off</h2>
        <p className="text-sm text-primary">Signing in will ask only for your password.</p>
        <PasswordStep id="password-off" label="Your password" action="Turn off two-step sign-in" busyLabel="Turning off…" onPassword={turnOff} />
      </section>
    </Frame>
  );
}

/** Enrol an authenticator app (QR code, key, recovery codes, first code), or manage one already on. */
export function TwoFactorSetup({ enabled, email }: { enabled: boolean; email: string }) {
  return enabled ? <Manage /> : <Enrol email={email} />;
}
