// The next step as the page shows it (U13). The gate's next step is stage-wide and knows nothing of the install's
// set-up or of drafts waiting, so three things are worked out here, from data the browser already has:
//   1. a step whose page needs a service that is not set up becomes "set it up": a Perplexity key, a reasoning
//      model, a printer, a channel account, with the Admin page that does it;
//   2. a "Draft ... with AI" step with drafts already waiting becomes "Review N waiting drafts";
//   3. when the step is on another page, the line "On this page" names the first unmet thing this page can do.
// Pure: no I/O, safe for the browser and for tests.
import { ADMIN_CREDENTIALS, ADMIN_MODELS, ADMIN_PRINTERS } from "@/lib/adminLinks";
import { UNLOCK_STORES } from "@/lib/plan";
import type { NextStep } from "./evaluate";

/** What is set up, from /api/integrations. Unknown (still loading) changes nothing. */
export type Services = { reasoning: boolean; perplexity: boolean; printer: boolean; x: boolean; instagram: boolean; amazonSell: boolean };

export type PageCheck = { met: boolean; action: string; href: string; label: string; detail: string };

const pathOf = (href: string) => href.split(/[?#]/)[0];

/** The store a section page's drafts are saved in ("/s/prototype/sourcing" drafts parts into design/bom). */
export function storeOfPath(path: string): string | null {
  const m = /^\/s\/([^/]+\/[^/]+)$/.exec(path);
  if (!m) return null;
  return UNLOCK_STORES.get(m[1]) ?? m[1];
}

const isDraftStep = (s: Pick<NextStep, "label" | "href">) => /with AI\b/.test(s.label) || s.href.endsWith("#draft-with-ai");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One step, with set-up and waiting drafts taken into account. */
export function refineStep(step: NextStep, services: Services | null, pending: Record<string, number> | null): NextStep {
  const path = pathOf(step.href);
  if (isDraftStep(step)) {
    const store = storeOfPath(path);
    const n = store && pending ? pending[store] ?? 0 : 0;
    if (n > 0) return { label: `Review ${plural(n, "waiting draft", "waiting drafts")}`, reason: `${step.reason} Drafts are already waiting for this; approve or reject them before drafting again.`, href: `${path}#draft-with-ai` };
    if (services && !services.reasoning) return { label: "Choose a reasoning model in Admin, Models", reason: `${step.reason} Drafting needs a reasoning model, and none is chosen yet.`, href: ADMIN_MODELS };
  }
  if (!services) return step;
  if (path === "/s/research/ask" && !services.perplexity) {
    return { label: "Connect Perplexity in Admin, Credentials", reason: `${step.reason} Research, Ask needs a Perplexity key, and none is saved yet.`, href: ADMIN_CREDENTIALS };
  }
  if (path === "/s/marketing/posting" && !services.x && !services.instagram) {
    return { label: "Connect X or Instagram in Admin, Credentials", reason: `${step.reason} Posting needs a connected channel account.`, href: ADMIN_CREDENTIALS };
  }
  if (path === "/s/sales/monitor" && !services.amazonSell) {
    return { label: "Connect Amazon Seller Central in Admin, Credentials", reason: `${step.reason} Sales figures are read from Seller Central.`, href: ADMIN_CREDENTIALS };
  }
  if (path === "/s/prototype/printing" && /print job/i.test(step.label) && !services.printer) {
    return { label: "Add your printer in Admin, Printers", reason: `${step.reason} A print job is made for one of your printers; a printer you print on by hand counts too.`, href: ADMIN_PRINTERS };
  }
  return step;
}

/**
 * The first unmet check whose fix is on this page, when the next step is on another one. `checks` are every
 * stage's checks, the current stage's first.
 */
export function pageStep(pathname: string, next: NextStep, checks: PageCheck[], services: Services | null, pending: Record<string, number> | null): NextStep | null {
  if (!pathname.startsWith("/s/") || pathOf(next.href) === pathname) return null;
  const here = checks.find((c) => !c.met && pathOf(c.href) === pathname);
  if (!here) return null;
  return refineStep({ label: here.action, reason: `${here.label}. ${here.detail}`, href: here.href }, services, pending);
}
