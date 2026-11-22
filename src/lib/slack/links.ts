// Addresses of the app's pages, built from a base address. A message links to a page; it never carries a file's
// contents or a link that signs anyone in. Pure.
import { findSection } from "@/lib/menu";

/** What a builder needs from the app: where the app is reachable. */
export type SlackContext = { baseUrl: string };

/** The base address without a trailing slash; only http and https are accepted. */
function origin(baseUrl: string): string {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new Error("The Slack message needs the app's address as a full web address, such as https://c2r.example.com.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("The app's address must start with http or https.");
  return u.origin + u.pathname.replace(/\/+$/, "");
}

type Query = Record<string, string | number | undefined>;

/** `${base}${path}` with the query, in the order given. Values are percent-encoded. */
function address(ctx: SlackContext, path: string, query: Query = {}): string {
  const q = Object.entries(query)
    .filter((e): e is [string, string | number] => e[1] !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${origin(ctx.baseUrl)}${path}${q ? (path.includes("?") ? "&" : "?") + q : ""}`;
}

/** Admin, with the tab the page keeps in the address (src/components/admin/AdminView.tsx). */
export const adminLink = (ctx: SlackContext, tab?: "setup" | "credentials" | "models" | "printers" | "audit" | "access"): string => address(ctx, "/admin", tab ? { tab } : {});

/** A page of one concept: `?concept=<id>` makes it the current concept (src/components/concepts/ConceptFromUrl.tsx). */
export const conceptLink = (ctx: SlackContext, path: string, conceptId: string, query: Query = {}): string => address(ctx, path, { ...query, concept: conceptId });

/** A menu section's page, and one row of it with `?item=<id>`. The section must exist in the menu. */
export function sectionLink(ctx: SlackContext, conceptId: string, stage: string, section: string, itemId?: number): string {
  const found = findSection(stage, section);
  if (!found) throw new Error(`There is no section ${stage}/${section} in the menu.`);
  return conceptLink(ctx, found.section.href ?? `/s/${stage}/${section}`, conceptId, { item: itemId });
}

/** The same lookup for a page that needs no menu: the concept's status page and the like. */
export const pageLink = (ctx: SlackContext, path: "/status" | "/process" | "/drafts" | "/files", conceptId: string): string => conceptLink(ctx, path, conceptId);

/** The account page: the nearest page to workspace members until the members page exists. */
export const accountLink = (ctx: SlackContext): string => address(ctx, "/auth/account");

/** Stripe's dashboard page for a customer, or the payments list when the customer is not known. */
export const stripeLink = (customerId?: string): string => (customerId ? `https://dashboard.stripe.com/customers/${customerId}` : "https://dashboard.stripe.com/payments");
