/**
 * The early-access offer: a short form (email and one line) and the count of
 * places left out of the limit. Contract shared by the page and the server work:
 * a server component, safe to render several times on one page.
 */
export type EarlyAccessPlacement = "hero" | "pricing" | "close";

export async function EarlyAccess({ placement }: { placement: EarlyAccessPlacement }) {
  return <div data-early-access={placement} />;
}
