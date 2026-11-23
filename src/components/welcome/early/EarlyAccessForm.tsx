"use client";

/**
 * The early-access form: email and "What do you want to make?". Drawn complete by the server as a plain form that
 * posts to /api/access-requests, so it works without script (the answer is then the page /welcome/early). With
 * script it is checked here with the server's own schema, sent as JSON, and the answer replaces the form: the
 * place number or the waiting-list position, what happens next, and the optional details (name, company, plan),
 * sent with the token from that answer. Every field id is unique, so the form can appear several times on a page; once
 * one of them has an answer, the others show it in one line (./places.ts).
 */
import { useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, describe } from "@/components/ui/field";
import { SaveError } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { ACCESS_LEVELS, ACCESS_LEVEL_LABEL, ACCESS_LIMITS, AccessRequestDetails, AccessRequestForm, ACTION_LABEL, claimedLine, MAKING_MAX, type AccessRequestAnswer, type EarlyAccessOutcome, type Placement } from "@/lib/accessRequests/shared";
import { answered, forgetMine, useMine, usePlaces } from "./places";
import { track, trackOnce, visitId } from "./track";

type Errors = Partial<Record<"email" | "building", string>>;

const NEXT_STEP: Record<EarlyAccessOutcome["kind"], string> = {
  place: "Early access takes no payment. When your workspace opens, the email tells you how to sign in.",
  waiting: "Early access takes no payment. Places that open go to the waiting list in order.",
  listed: "Nothing more is needed. If you meant another address, send the form again with it.",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "The form could not be sent. Try again in a moment.");
  return data;
}

export function EarlyAccessForm({ placement, full, compact }: { placement: Placement; full: boolean; compact: boolean }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState("");
  const [sending, setSending] = useState(false);
  const [answer, setAnswer] = useState<AccessRequestAnswer | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const makingRef = useRef<HTMLInputElement>(null);
  const mine = useMine();
  // the latest count on the page: once the places run out, every form offers the waiting list
  const action = (usePlaces(null)?.full ?? full) ? ACTION_LABEL.wait : ACTION_LABEL.claim;

  const started = () => trackOnce(`form:${placement}`, "form_start", { placement }, placement);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFailure("");
    const data = new FormData(e.currentTarget);
    const values = { email: String(data.get("email") ?? ""), building: String(data.get("building") ?? ""), website: String(data.get("website") ?? ""), placement, visit: visitId() || undefined };
    const parsed = AccessRequestForm.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const i of parsed.error.issues) {
        const f = i.path[0];
        if ((f === "email" || f === "building") && !next[f]) next[f] = i.message;
      }
      setErrors(next);
      (next.email ? emailRef : makingRef).current?.focus();
      track("form_error", { placement, field: next.email ? "email" : "building" }, placement);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const got = await postJson<AccessRequestAnswer>("/api/access-requests", values);
      setAnswer(got);
      answered(got.outcome);
    } catch (err) {
      setFailure((err as Error).message);
      track("form_error", { placement, field: "server" }, placement);
    } finally {
      setSending(false);
    }
  };

  if (answer) return <Answer answer={answer} placement={placement} />;
  // another form on the page (or this tab before a reload) already has the answer
  if (mine) return <Claimed outcome={mine} />;

  return (
    <form action="/api/access-requests" method="post" onSubmit={(e) => void submit(e)} noValidate className="relative grid gap-3" data-early-form={placement}>
      <input type="hidden" name="placement" value={placement} />
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" : "sm:grid-cols-2")}>
        <Field id={id("email")} label="Email" required error={errors.email}>
          <Input ref={emailRef} id={id("email")} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={ACCESS_LIMITS.email} onFocus={started} {...describe(id("email"), { error: errors.email })} />
        </Field>
        <Field id={id("building")} label="What do you want to make?" required error={errors.building}>
          <Input ref={makingRef} id={id("building")} name="building" required minLength={3} maxLength={MAKING_MAX} placeholder="One line is plenty" onFocus={started} {...describe(id("building"), { error: errors.building })} />
        </Field>
      </div>
      {/* A honeypot: hidden from people and out of the tab order. Scripts that fill every box fill this one too. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={id("website")}>Leave this field empty</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <SaveError message={failure} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={sending} data-track={`cta:early-${placement}`}>
          {sending ? "Sending…" : action}
        </Button>
        {!compact ? <p className="text-xs text-muted">Early access takes no payment.</p> : null}
      </div>
    </form>
  );
}

/** The compact line a form shows instead of itself once another form on the page has its answer. */
function Claimed({ outcome }: { outcome: EarlyAccessOutcome }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-early-mine={outcome.kind}>
      <p className="flex items-center gap-2 text-base font-semibold text-primary">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
        {claimedLine(outcome)}
      </p>
      <Button type="button" variant="link" size="sm" className="px-1" onClick={forgetMine}>
        Use another address
      </Button>
    </div>
  );
}

/** What the visitor sees once the form is sent: the outcome, what happens next, and the optional details. */
export function Answer({ answer, placement, noScriptToken }: { answer: Pick<AccessRequestAnswer, "message" | "outcome" | "token">; placement: Placement; noScriptToken?: string }) {
  const token = answer.token ?? noScriptToken;
  return (
    <div className="grid gap-4" data-early-answer={answer.outcome.kind}>
      <div role="status" className="flex gap-3 rounded-xl border border-hairline bg-surface p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-base font-semibold text-primary">{answer.message}</p>
          <p className="mt-1 text-sm text-secondary">{NEXT_STEP[answer.outcome.kind]}</p>
        </div>
      </div>
      {token && answer.outcome.kind !== "listed" ? <Details token={token} placement={placement} script={!noScriptToken} /> : null}
    </div>
  );
}

/** The optional details: a second small form, tied to the request by its token (never by the email). */
function Details({ token, placement, script }: { token: string; placement: Placement; script: boolean }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [done, setDone] = useState("");
  const [failure, setFailure] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    if (!script) return; // the plain post goes to the server and back to /welcome/early
    e.preventDefault();
    setFailure("");
    const data = new FormData(e.currentTarget);
    const parsed = AccessRequestDetails.safeParse({ token, name: String(data.get("name") ?? ""), company: String(data.get("company") ?? ""), level: String(data.get("level") ?? "") });
    if (!parsed.success) {
      setFailure(parsed.error.issues[0]?.message ?? "Check the details.");
      return;
    }
    setSending(true);
    try {
      setDone((await postJson<{ message: string }>("/api/access-requests/details", parsed.data)).message);
      track("form_submit", { placement, step: "details" }, placement);
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (done) return <p role="status" className="text-sm text-secondary">{done}</p>;
  return (
    <form action="/api/access-requests/details" method="post" onSubmit={(e) => void submit(e)} noValidate aria-labelledby={id("title")} className="grid gap-3 rounded-xl border border-hairline bg-subtle p-5">
      <input type="hidden" name="token" value={token} />
      <p id={id("title")} className="text-sm font-medium text-primary">
        Tell us a little more <span className="font-normal text-muted">(optional)</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={id("name")} label="Your name">
          <Input id={id("name")} name="name" autoComplete="name" maxLength={ACCESS_LIMITS.name} />
        </Field>
        <Field id={id("company")} label="Company">
          <Input id={id("company")} name="company" autoComplete="organization" maxLength={ACCESS_LIMITS.company} />
        </Field>
        <Field id={id("level")} label="Plan you expect to use">
          <NativeSelect id={id("level")} name="level" defaultValue="">
            <option value="">Not sure yet</option>
            {ACCESS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {ACCESS_LEVEL_LABEL[l]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <SaveError message={failure} />
      <div>
        <Button type="submit" variant="outline" size="sm" disabled={sending}>
          {sending ? "Saving…" : "Save these details"}
        </Button>
      </div>
    </form>
  );
}
