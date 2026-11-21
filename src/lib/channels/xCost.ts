// What X charges, as read from X's own pricing page. X changes its pricing often, so the statement
// carries the date it was read and a version; a new version needs a new acknowledgement before any send.
// Safe for the browser (no I/O).
//
// Source, read 21 Nov 2026: https://docs.x.com/x-api/getting-started/pricing
//   "The X API uses pay-per-usage pricing. No subscriptions." Credits are bought in the Developer Console.
//   Write operations, per request: Post: Create $0.015; Post: Create (with URL) $0.200; Media Metadata $0.005.
//   Read operations, per resource: Posts: Read $0.005; User: Read $0.010.
//   Owned Reads $0.001 per resource, including GET /2/users/{id}/mentions when {id} is the authenticated
//   user and that user owns the developer app. Resources are de-duplicated within a 24-hour UTC day.
//   "Prices are subject to change. Current rates are always available in the Developer Console."

const X_PRICING_URL = "https://docs.x.com/x-api/getting-started/pricing";
const X_PRICING_READ = "2026-11-21";

export const X_RATES = {
  postCreate: 0.015,
  postCreateWithUrl: 0.2,
  postRead: 0.005,
  ownedRead: 0.001,
  userRead: 0.01,
} as const;

export const X_COST_STATEMENT = {
  version: `x-pay-per-usage-${X_PRICING_READ}`,
  read: X_PRICING_READ,
  url: X_PRICING_URL,
  tier: "Pay-per-usage (no subscription tiers; credits bought in advance in the X Developer Console)",
  lines: [
    `A post costs $${X_RATES.postCreate.toFixed(3)} per request.`,
    `A post that contains a web address costs $${X_RATES.postCreateWithUrl.toFixed(3)} per request.`,
    `Reading your mentions costs $${X_RATES.ownedRead.toFixed(3)} per post returned when you own the developer app, otherwise $${X_RATES.postRead.toFixed(3)}.`,
    `The connection test reads your own account: $${X_RATES.userRead.toFixed(3)} per X's user read rate.`,
    "Uploading an image is not listed with a price on that page.",
    "X says prices change and the Developer Console always has the current rates. Check it before relying on these figures.",
  ],
} as const;

/** X counts a link in a post: anything that looks like a web address. */
const hasUrl = (text: string) => /\bhttps?:\/\/\S+|\bwww\.\S+\.\S+|\b[a-z0-9-]+\.(com|net|org|io|co|ai|app|dev|shop|store)\b/i.test(text);

/** The price of sending one post or reply with this text, per the statement. */
export function postCost(text: string): { usd: number; rule: string } {
  return hasUrl(text)
    ? { usd: X_RATES.postCreateWithUrl, rule: "Post: Create (with URL)" }
    : { usd: X_RATES.postCreate, rule: "Post: Create" };
}
