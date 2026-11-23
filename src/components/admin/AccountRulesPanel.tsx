"use client";

// Admin, Sign-in: the account rules of the owner's ruling of 23 Nov (src/lib/auth2/rules.ts). Invitations' life,
// the lock after failed sign-ins, the password rules and whether anyone may create an account. The platform
// administrator changes them; the server checks each against its bounds and records the change in the audit log.
// The address sign-up requests are sent to is on Admin, Email (NotifyPanel below).
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { SaveError } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { useSaveSignIn } from "@/lib/admin/client";
import type { AccountRules } from "@/lib/auth2/rules";
import { policySummary } from "@/lib/auth2/passwordPolicy";

type Flags = "upper" | "lower" | "digit" | "symbol" | "notEmailOrName" | "notCommon";
const FLAG_LABEL: Record<Flags, string> = {
  upper: "An upper-case letter",
  lower: "A lower-case letter",
  digit: "A digit",
  symbol: "A symbol",
  notEmailOrName: "Not the person's email address or name",
  notCommon: "Not one of the 3,000 most common passwords (list bundled with the app)",
};

function Check({ id, label, checked, onChange, disabled }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-primary">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 accent-dutchOrange" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function AccountRulesPanel({ rules, canWrite }: { rules: AccountRules; canWrite: boolean }) {
  const [days, setDays] = useState(String(rules.inviteExpiryDays));
  const [max, setMax] = useState(String(rules.maxFailures));
  const [untilUnlock, setUntilUnlock] = useState(rules.lockMinutes === 0);
  const [minutes, setMinutes] = useState(String(rules.lockMinutes || 30));
  const [minLength, setMinLength] = useState(String(rules.password.minLength));
  const [flags, setFlags] = useState<Record<Flags, boolean>>({ upper: rules.password.upper, lower: rules.password.lower, digit: rules.password.digit, symbol: rules.password.symbol, notEmailOrName: rules.password.notEmailOrName, notCommon: rules.password.notCommon });
  const [signUpOpen, setSignUpOpen] = useState(rules.signUpOpen);
  const [error, setError] = useState("");
  const save = useSaveSignIn();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const n = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
    save.mutate(
      {
        rules: {
          inviteExpiryDays: n(days),
          maxFailures: n(max),
          lockMinutes: untilUnlock ? 0 : n(minutes),
          password: { minLength: n(minLength), ...flags },
          signUpOpen,
        },
      },
      { onSuccess: () => toast.success("The account rules are saved."), onError: (err) => setError(messageOf(err)) }
    );
  };

  return (
    <Panel title="Account rules" description="Invitations, the lock after failed sign-ins, password rules and sign-up. A new password rule applies the next time a password is chosen; existing passwords keep working.">
      <form onSubmit={submit} noValidate className="space-y-5" aria-label="Account rules">
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={!canWrite}>
          <legend className="mb-1 text-sm font-medium text-primary">Invitations and the lock</legend>
          <Field id="rules-days" label="Days an invitation works" hint="1 to 30. Counted from when it was last sent. Default 7.">
            <Input id="rules-days" type="number" inputMode="numeric" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} {...describe("rules-days", { hint: true })} />
          </Field>
          <Field id="rules-max" label="Failed sign-ins in a row before the lock" hint="3 to 20. Default 7. A right password sets the count back to 0.">
            <Input id="rules-max" type="number" inputMode="numeric" min={3} max={20} value={max} onChange={(e) => setMax(e.target.value)} {...describe("rules-max", { hint: true })} />
          </Field>
          <Field id="rules-minutes" label="Minutes the lock lasts" hint="5 to 1,440. Default 30. A password reset or an administrator lifts it at once.">
            <Input id="rules-minutes" type="number" inputMode="numeric" min={5} max={1440} value={minutes} disabled={untilUnlock || !canWrite} onChange={(e) => setMinutes(e.target.value)} {...describe("rules-minutes", { hint: true })} />
          </Field>
          <div className="self-end pb-2">
            <Check id="rules-until" label="Until an administrator unlocks it (platform administrators are always unlocked after the minutes above)" checked={untilUnlock} onChange={setUntilUnlock} disabled={!canWrite} />
          </div>
        </fieldset>

        <fieldset className="space-y-3" disabled={!canWrite}>
          <legend className="mb-1 text-sm font-medium text-primary">Passwords</legend>
          <Field id="rules-min" label="Shortest password" hint="8 to 64 characters. Default 12. The longest is 128.">
            <Input id="rules-min" type="number" inputMode="numeric" min={8} max={64} value={minLength} onChange={(e) => setMinLength(e.target.value)} className="max-w-32" {...describe("rules-min", { hint: true })} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(FLAG_LABEL) as Flags[]).map((k) => (
              <Check key={k} id={`rules-${k}`} label={FLAG_LABEL[k]} checked={flags[k]} onChange={(v) => setFlags((f) => ({ ...f, [k]: v }))} disabled={!canWrite} />
            ))}
          </div>
          <p className="text-xs text-secondary">In force now: {policySummary(rules.password)}</p>
        </fieldset>

        <fieldset className="space-y-2" disabled={!canWrite}>
          <legend className="mb-1 text-sm font-medium text-primary">Sign-up</legend>
          <Check id="rules-signup" label="Anyone may create an account themselves" checked={signUpOpen} onChange={setSignUpOpen} disabled={!canWrite} />
          <p className="text-xs text-secondary">
            Off by default, as during early access: the sign-up page then takes a request for an account, which is listed in Access requests and emailed to the address on Admin, Email. People with an invitation can still create their account.
          </p>
        </fieldset>

        {error ? <SaveError message={error} /> : null}
        {canWrite ? <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save the account rules"}</Button> : null}
      </form>
    </Panel>
  );
}

/** Admin, Email: where requests for an account and early-access requests are announced (setting notify.signupRequestsTo). */
export function NotifyPanel({ to, mail, canWrite }: { to: string | null; mail: boolean; canWrite: boolean }) {
  const [value, setValue] = useState(to ?? "");
  const [error, setError] = useState("");
  const save = useSaveSignIn();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    save.mutate({ rules: { notifySignupRequestsTo: value.trim() } }, { onSuccess: () => toast.success("Saved."), onError: (err) => setError(messageOf(err)) });
  };
  return (
    <Panel title="Sign-up requests" description="Each request for early access or for an account is listed in Access requests and, when mail is set up, announced by email to this address. The email says who asked and what they want to make, with a link to Admin; nothing secret.">
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field id="notify-to" label="Send sign-up requests to" hint="Default jim@eigenia.nl. Leave empty to send none.">
          <Input id="notify-to" type="email" autoCapitalize="none" spellCheck={false} value={value} disabled={!canWrite} onChange={(e) => setValue(e.target.value)} {...describe("notify-to", { hint: true })} />
        </Field>
        {!mail ? <p role="note" className="rounded-md bg-info-soft px-3 py-2 text-sm text-info">No mail server is set up, so nothing is sent yet; requests are still listed in Access requests.</p> : null}
        {error ? <SaveError message={error} /> : null}
        {canWrite ? <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button> : null}
      </form>
    </Panel>
  );
}
