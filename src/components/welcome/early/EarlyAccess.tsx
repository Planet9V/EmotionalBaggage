/**
 * The early-access offer: a short form (email and one line) and the count of places left out of the limit. Contract
 * shared by the page and the server work: a server component, safe to render several times on one page.
 *
 * It shows: the count line from the database ("N of 50 early-access places left", or "Early access is full. Join
 * the waiting list." at zero), the form (./EarlyAccessForm.tsx: works without script), and the price line from the
 * plan catalogue ("After early access: Maker $20 a month, Studio $40 a month."). "hero" is compact; "close" adds
 * what happens next; the confirmation page ("page") also the privacy sentence, which the welcome page has in its footer. Nothing here throws: with the database unreadable the form still
 * shows, without the count.
 */
import { cache } from "react";
import { earlyAccessCount } from "@/lib/accessRequests/places";
import { publicLevels } from "@/lib/admin/plans";
import type { EarlyAccessCount, Placement } from "@/lib/accessRequests/shared";
import type { PublicLevels } from "@/lib/admin/planSchema";
import { cn } from "@/lib/utils";
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

/** The count line, or null when the count could not be read. */
function countLine(c: EarlyAccessCount | null): string | null {
  if (!c) return null;
  return c.left > 0 ? `${c.left} of ${c.limit} early-access places left` : "Early access is full. Join the waiting list.";
}

export async function EarlyAccess({ placement }: { placement: EarlyAccessPlacement }) {
  return EarlyAccessBlock({ placement });
}

/** The offer for any placement, including the confirmation page's own ("page"). */
export async function EarlyAccessBlock({ placement }: { placement: Placement }) {
  const [count, levels] = await Promise.all([readCount(), readLevels()]);
  const line = countLine(count);
  const prices = priceLine(levels);
  const compact = placement === "hero";
  const full = count !== null && count.left === 0;
  return (
    <div data-early-access={placement} id={`early-access-${placement}`} className={cn("group/early grid scroll-mt-24", compact ? "gap-2" : "gap-4")}>
      {/* the count was read when the page was drawn: once this form has given its answer, the answer stands alone */}
      {line ? (
        <p className={cn("flex items-center gap-2 font-semibold text-primary group-has-[[data-early-answer]]/early:hidden", compact ? "text-[15px]" : "text-base")} data-early-count={count?.left ?? ""}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
          {line}
        </p>
      ) : null}
      <EarlyAccessForm placement={placement} full={full} compact={compact} />
      {/* in the pricing block the plan cards under the form carry the prices */}
      {prices && placement !== "pricing" ? <p className="text-sm text-secondary">{prices}</p> : null}
      {placement === "close" || placement === "page" ? (
        <>
          <ol className="grid gap-1 text-sm text-secondary sm:grid-cols-3 sm:gap-4">
            <li><span className="font-mono text-link">1</span> You claim a place with your email and one line.</li>
            <li><span className="font-mono text-link">2</span> We open workspaces in the order places were claimed.</li>
            <li><span className="font-mono text-link">3</span> We write to that address when yours is ready.</li>
          </ol>
          {/* the welcome page says this once, in its footer; the confirmation page has no footer */}
          {placement === "page" ? <p className="text-xs text-muted">{PRIVACY}</p> : null}
        </>
      ) : null}
    </div>
  );
}
