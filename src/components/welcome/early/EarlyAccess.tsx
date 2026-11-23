/**
 * The early-access offer: a short form (email and one line) and the count of places left out of the limit. Contract
 * shared by the page and the server work: a server component, safe to render several times on one page.
 *
 * It shows: the count line from the database ("N of 50 early-access places left", or "Early access is full. Join
 * the waiting list." at zero), the form (./EarlyAccessForm.tsx: works without script), and the price line from the
 * plan catalogue ("After early access: Maker $20 a month, Studio $40 a month."). In the browser the count lines and
 * the forms share one store (./places.ts): after one form answers, every count is read again and the other forms say
 * "You have place number N" (or the waiting-list line) instead of offering the form a second time. "hero" is compact; "close" adds
 * what happens next; the confirmation page ("page") also the privacy sentence, which the welcome page has in its footer. Nothing here throws: with the database unreadable the form still
 * shows, without the count.
 */
import { cache } from "react";
import { earlyAccessCount } from "@/lib/accessRequests/places";
import { publicLevels } from "@/lib/admin/plans";
import { publicPlaces, type EarlyAccessCount, type Placement } from "@/lib/accessRequests/shared";
import type { PublicLevels } from "@/lib/admin/planSchema";
import { cn } from "@/lib/utils";
import { CountLine } from "./CountLine";
import { EarlyAccessForm } from "./EarlyAccessForm";

export type EarlyAccessPlacement = "hero" | "pricing" | "close";

/** The one privacy sentence the page carries about counting visits (docs/design/early-access.md). */
const PRIVACY = "Visits to this page are counted on our own server. Nothing is sent to anyone else.";

/** Read once per request however many times the offer is drawn. */
const readCount = cache(async (): Promise<EarlyAccessCount | null> => earlyAccessCount().catch(() => null));
const readLevels = cache(async (): Promise<PublicLevels | null> => publicLevels().catch(() => null));

/** "After early access: Maker $20 a month, Studio $40 a month.", from the shown paid plans with a price; "" when prices are off. */
function priceLine(levels: PublicLevels | null): string {
  if (!levels?.showPrices) return "";
  const parts = levels.levels.filter((l) => l.paid && l.price).map((l) => `${l.name} ${l.price}${l.per ? ` ${l.per}` : ""}`);
  return parts.length ? `After early access: ${parts.join(", ")}.` : "";
}

/** What happens after a place is claimed, in the close block and on the confirmation page. */
const NEXT_STEPS = ["You claim a place with your email and one line.", "We open workspaces in the order places were claimed.", "We write to that address when yours is ready."];

export async function EarlyAccess({ placement }: { placement: EarlyAccessPlacement }) {
  return EarlyAccessBlock({ placement });
}

/** The offer for any placement, including the confirmation page's own ("page"). */
export async function EarlyAccessBlock({ placement }: { placement: Placement }) {
  const [count, levels] = await Promise.all([readCount(), readLevels()]);
  const places = count ? publicPlaces(count) : null;
  const prices = priceLine(levels);
  const compact = placement === "hero";
  const full = places?.full ?? false;
  const stepsId = `early-access-${placement}-next`;
  return (
    <div data-early-access={placement} id={`early-access-${placement}`} className={cn("group/early @container grid scroll-mt-24", compact ? "gap-2" : "gap-4")}>
      {/* every count line on the page follows the latest reading (./places.ts); the block that answered hides its own */}
      {places ? <CountLine initial={places} compact={compact} /> : null}
      <EarlyAccessForm placement={placement} full={full} compact={compact} />
      {/* in the pricing block the plan cards under the form carry the prices */}
      {prices && placement !== "pricing" ? <p className="text-sm text-secondary">{prices}</p> : null}
      {placement === "close" || placement === "page" ? (
        <>
          {/* one step a row while the block is narrow (the close block's column, a phone); three across from 42rem */}
          <div className="grid gap-2">
            <p id={stepsId} className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">What happens next</p>
            <ol aria-labelledby={stepsId} className="grid gap-2.5 @2xl:grid-cols-3 @2xl:gap-4">
              {NEXT_STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-secondary">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline font-mono text-xs text-link" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="min-w-0 max-w-[48ch] text-pretty">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {/* the welcome page says this once, in its footer; the confirmation page has no footer */}
          {placement === "page" ? <p className="text-xs text-muted">{PRIVACY}</p> : null}
        </>
      ) : null}
    </div>
  );
}
