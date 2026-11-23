import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { EarlyAccessBlock } from "@/components/welcome/early/EarlyAccess";
import { Answer } from "@/components/welcome/early/EarlyAccessForm";
import { outcomeByToken } from "@/lib/accessRequests/places";
import { EARLY_COOKIE, NO_SCRIPT_ERRORS, type NoScriptError } from "@/lib/accessRequests/noScript";
import { outcomeMessage, type EarlyAccessOutcome } from "@/lib/accessRequests/shared";

export const metadata = { title: "Early access: Shipwright", robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isError = (v: string): v is NoScriptError => Object.hasOwn(NO_SCRIPT_ERRORS, v);

/*
 * The early-access confirmation page, for a form sent without script (src/lib/accessRequests/noScript.ts): the
 * request's outcome, read by the token in this page's cookie, and the optional details form; or the refusal and the
 * form again. With script the same answer appears in place on /welcome and this page is not needed.
 */
export default async function EarlyAccessPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const token = (await cookies()).get(EARLY_COOKIE)?.value ?? "";
  const validToken = /^[A-Za-z0-9_-]{20,80}$/.test(token) ? token : "";
  const outcome: EarlyAccessOutcome | null = one(q.r) === "listed" ? { kind: "listed" } : validToken ? await outcomeByToken(validToken).catch(() => null) : null;
  const error = one(q.e);
  const saved = one(q.saved) === "1";

  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <div className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/welcome" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the welcome page
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Early access</h1>
        {isError(error) && error !== "expired" ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {NO_SCRIPT_ERRORS[error]}
          </p>
        ) : null}
        {saved ? <p role="status" className="text-sm text-secondary">Thank you. Your details are saved with your request.</p> : null}
        {outcome ? (
          <Answer answer={{ outcome, message: outcomeMessage(outcome) }} placement="page" noScriptToken={saved ? undefined : validToken || undefined} />
        ) : (
          <>
            {error === "expired" ? <p role="status" className="text-sm text-secondary">{NO_SCRIPT_ERRORS.expired}</p> : null}
            {await EarlyAccessBlock({ placement: "page" })}
          </>
        )}
      </main>
    </div>
  );
}
