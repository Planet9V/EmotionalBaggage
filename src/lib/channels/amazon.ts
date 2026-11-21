// Amazon Selling Partner API, read only (plan 8.17). Read from Amazon's developer documentation on
// 21 Nov 2026:
//   [LWA]     https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api
//             POST https://api.amazon.com/auth/o2/token, grant_type=refresh_token, form encoded;
//             access token valid for expires_in seconds (3600); sent as the x-amz-access-token header.
//   [REG]     https://developer-docs.amazon.com/sp-api/docs/sp-api-registration-overview
//             "in Seller Central, you must have a professional selling account to develop SP-API"
//             applications (private, self-authorized apps give the refresh token).
//   [ORDERS]  https://developer-docs.amazon.com/sp-api/docs/orders-api : v0 is deprecated; current is
//             v2026-01-01, GET /orders/2026-01-01/orders (searchOrders). Orders older than two years are
//             not returned. Roles: at least one of a list that includes "Inventory and Order Tracking".
//   [SEARCH]  https://developer-docs.amazon.com/sp-api/reference/searchorders : exactly one of createdAfter
//             or lastUpdatedAfter; marketplaceIds; maxResultsPerPage 1..100; paginationToken from
//             pagination.nextToken; includedData BUYER, RECIPIENT, PROCEEDS, ... Order has orderId,
//             createdTime, lastUpdatedTime, salesChannel.marketplaceId, orderItems[] with quantityOrdered and
//             product.asin / sellerSku / price.unitPrice (Money: amount as a decimal string, currencyCode).
//   [RATES]   https://developer-docs.amazon.com/sp-api/docs/orders-api-rate-limits : searchOrders 0.0056
//             requests per second, burst 20.
//   [SALES]   https://developer-docs.amazon.com/sp-api/reference/getordermetrics : GET /sales/v1/orderMetrics,
//             marketplaceIds, interval "start--end", granularity Day, granularityTimeZone; rate 0.5, burst 15.
//             Roles: "Inventory and Order Tracking" or "Product Listing" outside the Far East region.
//   [RDT]     Buyer name, e-mail and addresses are restricted data that needs a Restricted Data Token.
//             This code never asks for BUYER or RECIPIENT and never requests a Restricted Data Token.
//   [MKT]     https://developer-docs.amazon.com/sp-api/docs/marketplace-ids
import { sha256 } from "@/lib/hash";
import { HttpError } from "@/lib/api/route";
import { getSecretFor } from "@/lib/secretOrigin";
import { ChannelError, channelFetch, lwaTokenUrl, readJson, saysOf, spApiBase, upstreamError, type SpRegion } from "./http";
import { limited, TokenBucket, channelClock } from "./rateLimit";

export type Marketplace = { id: string; country: string; name: string; region: SpRegion; currency: string };

/** Marketplace ids from [MKT]. */
export const MARKETPLACES: Marketplace[] = [
  { id: "ATVPDKIKX0DER", country: "US", name: "Amazon.com (United States)", region: "na", currency: "USD" },
  { id: "A2EUQ1WTGCTBG2", country: "CA", name: "Amazon.ca (Canada)", region: "na", currency: "CAD" },
  { id: "A1AM78C64UM0Y8", country: "MX", name: "Amazon.com.mx (Mexico)", region: "na", currency: "MXN" },
  { id: "A2Q3Y263D00KWC", country: "BR", name: "Amazon.com.br (Brazil)", region: "na", currency: "BRL" },
  { id: "A1F83G8C2ARO7P", country: "UK", name: "Amazon.co.uk (United Kingdom)", region: "eu", currency: "GBP" },
  { id: "A1PA6795UKMFR9", country: "DE", name: "Amazon.de (Germany)", region: "eu", currency: "EUR" },
  { id: "A13V1IB3VIYZZH", country: "FR", name: "Amazon.fr (France)", region: "eu", currency: "EUR" },
  { id: "APJ6JRA9NG5V4", country: "IT", name: "Amazon.it (Italy)", region: "eu", currency: "EUR" },
  { id: "A1RKKUPIHCS9HS", country: "ES", name: "Amazon.es (Spain)", region: "eu", currency: "EUR" },
  { id: "A1805IZSGTT6HS", country: "NL", name: "Amazon.nl (Netherlands)", region: "eu", currency: "EUR" },
  { id: "AMEN7PMS3EDWL", country: "BE", name: "Amazon.com.be (Belgium)", region: "eu", currency: "EUR" },
  { id: "A2NODRKZP88ZB9", country: "SE", name: "Amazon.se (Sweden)", region: "eu", currency: "SEK" },
  { id: "A1C3SOZRARQ6R3", country: "PL", name: "Amazon.pl (Poland)", region: "eu", currency: "PLN" },
  { id: "A33AVAJ2PDY3EV", country: "TR", name: "Amazon.com.tr (Turkey)", region: "eu", currency: "TRY" },
  { id: "A2VIGQ35RCS4UG", country: "AE", name: "Amazon.ae (United Arab Emirates)", region: "eu", currency: "AED" },
  { id: "A17E79C6D8DWNP", country: "SA", name: "Amazon.sa (Saudi Arabia)", region: "eu", currency: "SAR" },
  { id: "ARBP9OOSHTCHU", country: "EG", name: "Amazon.eg (Egypt)", region: "eu", currency: "EGP" },
  { id: "A21TJRUUN4KGV", country: "IN", name: "Amazon.in (India)", region: "eu", currency: "INR" },
  { id: "A1VC38T7YXB528", country: "JP", name: "Amazon.co.jp (Japan)", region: "fe", currency: "JPY" },
  { id: "A39IBJ37TRP1C6", country: "AU", name: "Amazon.com.au (Australia)", region: "fe", currency: "AUD" },
  { id: "A19VAU5U5O7RUS", country: "SG", name: "Amazon.sg (Singapore)", region: "fe", currency: "SGD" },
];

export const marketplace = (id: string) => MARKETPLACES.find((m) => m.id === id);

/** Documented default rates per operation [RATES] [SALES]. One bucket per operation for this install. */
export const AMAZON_RATES = { searchOrders: { rate: 0.0056, burst: 20 }, getOrderMetrics: { rate: 0.5, burst: 15 } } as const;
type Op = keyof typeof AMAZON_RATES;
let buckets: Record<Op, TokenBucket> | null = null;
const bucket = (op: Op) => {
  buckets ??= { searchOrders: new TokenBucket(AMAZON_RATES.searchOrders.rate, AMAZON_RATES.searchOrders.burst), getOrderMetrics: new TokenBucket(AMAZON_RATES.getOrderMetrics.rate, AMAZON_RATES.getOrderMetrics.burst) };
  return buckets[op];
};

// ---------------------------------------------------------------------------------------------
// Login with Amazon. The access token lives only in this process's memory: never stored, logged or returned.

type Cached = { token: string; expiresAt: number; fingerprint: string };
let cached: Cached | null = null;
let inflight: Promise<string> | null = null;

/** Forget the cached token and the buckets (credentials changed, or tests). */
export function resetAmazon() {
  cached = null;
  inflight = null;
  buckets = null;
}

export type AmazonCredentials = { refreshToken: string; clientId: string; clientSecret: string };

export async function amazonCredentials(): Promise<AmazonCredentials | null> {
  const [refreshToken, clientId, clientSecret] = await Promise.all([
    getSecretFor("amazon-sp", "refreshToken", lwaTokenUrl()),
    getSecretFor("amazon-sp", "clientId", lwaTokenUrl()),
    getSecretFor("amazon-sp", "clientSecret", lwaTokenUrl()),
  ]);
  return refreshToken && clientId && clientSecret ? { refreshToken, clientId, clientSecret } : null;
}

export const NOT_CONNECTED = "Amazon is not connected. Save the refresh token, client ID and client secret in Admin, Credentials, then press Test connection.";

const fingerprint = (c: AmazonCredentials) => sha256(`${c.clientId}\n${c.refreshToken}\n${c.clientSecret}`);

/** Exchanges the refresh token for an access token [LWA], cached until a minute before it expires. */
export async function amazonAccessToken(creds?: AmazonCredentials): Promise<string> {
  const c = creds ?? (await amazonCredentials());
  if (!c) throw new HttpError(503, NOT_CONNECTED);
  const fp = fingerprint(c);
  const now = channelClock().now();
  if (cached && cached.fingerprint === fp && cached.expiresAt - 60_000 > now) return cached.token;
  if (inflight) return inflight;
  inflight = (async () => {
    const secrets = [c.refreshToken, c.clientSecret, c.clientId];
    const res = await channelFetch(
      "Login with Amazon",
      lwaTokenUrl(),
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refreshToken, client_id: c.clientId, client_secret: c.clientSecret }).toString(),
      },
      secrets
    );
    if (res.status !== 200) {
      const says = await saysOf(res, secrets);
      throw new ChannelError(502, `Login with Amazon refused the saved refresh token, client ID or client secret (HTTP ${res.status}).${says ? ` It said: ${says}.` : ""}`);
    }
    const j = await readJson<{ access_token?: unknown; expires_in?: unknown }>(res);
    if (typeof j?.access_token !== "string" || !j.access_token) throw new ChannelError(502, "Login with Amazon answered without an access token.");
    const ttl = typeof j.expires_in === "number" && j.expires_in > 0 ? j.expires_in : 3600;
    cached = { token: j.access_token, expiresAt: channelClock().now() + ttl * 1000, fingerprint: fp };
    return j.access_token;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** One SP-API GET, through the operation's bucket, with one fresh token on a 403 that says the token expired. */
async function spGet(op: Op, region: SpRegion, path: string, query: URLSearchParams, maxWaitMs: number): Promise<unknown> {
  const creds = await amazonCredentials();
  if (!creds) throw new HttpError(503, NOT_CONNECTED);
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await amazonAccessToken(creds);
    const secrets = [token, creds.refreshToken, creds.clientSecret];
    const res = await limited(bucket(op), `Amazon's ${op} operation`, () =>
      channelFetch("Amazon SP-API", `${spApiBase(region)}${path}?${query.toString()}`, { headers: { "x-amz-access-token": token, accept: "application/json" } }, secrets),
      { maxWaitMs }
    );
    if (res.status === 200) return readJson(res);
    if (res.status === 403 && attempt === 0) {
      const says = await saysOf(res.clone(), secrets);
      if (/expired|unauthori[sz]ed/i.test(says)) {
        cached = null;
        continue;
      }
    }
    throw await upstreamError("Amazon SP-API", res, secrets);
  }
  throw new ChannelError(502, "Amazon SP-API refused a fresh access token.");
}

// ---------------------------------------------------------------------------------------------
// Orders: only order id, dates, marketplace, status, items (ASIN, SKU, quantity, amount). Nothing about the buyer.

export type CleanOrder = {
  orderId: string;
  createdTime: string;
  lastUpdatedTime: string;
  marketplaceId: string;
  status: string;
  currency: string;
  items: { asin?: string; sku?: string; quantity: number; amount: number }[];
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const money = (v: unknown): { amount: number; currency: string } | null => {
  const m = v as { amount?: unknown; currencyCode?: unknown } | undefined;
  const n = typeof m?.amount === "number" ? m.amount : typeof m?.amount === "string" ? Number(m.amount) : NaN;
  return Number.isFinite(n) ? { amount: n, currency: str(m?.currencyCode) } : null;
};

/** Picks the allowed fields out of one order from searchOrders. Anything else in the answer is dropped here. */
export function cleanOrder(raw: unknown): CleanOrder | null {
  const o = raw as Record<string, unknown>;
  const orderId = str(o?.orderId);
  if (!orderId) return null;
  const items: CleanOrder["items"] = [];
  let currency = "";
  for (const it of Array.isArray(o.orderItems) ? (o.orderItems as Record<string, unknown>[]) : []) {
    const product = (it.product ?? {}) as Record<string, unknown>;
    const quantity = typeof it.quantityOrdered === "number" && it.quantityOrdered >= 0 ? Math.round(it.quantityOrdered) : 0;
    const unit = money((product.price as { unitPrice?: unknown } | undefined)?.unitPrice);
    // Without a unit price, the item's proceeds total (PROCEEDS) is the amount.
    const proceeds = money((it.proceeds as { proceedsTotal?: unknown } | undefined)?.proceedsTotal);
    if (unit?.currency) currency ||= unit.currency;
    else if (proceeds?.currency) currency ||= proceeds.currency;
    const asin = str(product.asin);
    const sku = str(product.sellerSku);
    items.push({ ...(asin ? { asin: asin.slice(0, 20) } : {}), ...(sku ? { sku: sku.slice(0, 200) } : {}), quantity, amount: unit ? Math.round(unit.amount * quantity * 100) / 100 : proceeds ? Math.round(proceeds.amount * 100) / 100 : 0 });
  }
  const fulfilment = (o.fulfillment ?? {}) as { fulfillmentStatus?: unknown };
  const sales = (o.salesChannel ?? {}) as { marketplaceId?: unknown };
  return {
    orderId: orderId.slice(0, 60),
    createdTime: str(o.createdTime),
    lastUpdatedTime: str(o.lastUpdatedTime),
    marketplaceId: str(sales.marketplaceId),
    status: str(fulfilment.fulfillmentStatus),
    currency: currency.slice(0, 3),
    items,
  };
}

export type OrdersPage = { orders: CleanOrder[]; nextToken: string | null };

/** One page of searchOrders [SEARCH]. includedData asks only for PROCEEDS (amounts) and FULFILLMENT (the status), never BUYER or RECIPIENT. */
export async function searchOrders(o: { marketplaceId: string; lastUpdatedAfter: string; paginationToken?: string; maxWaitMs?: number }): Promise<OrdersPage> {
  const m = marketplace(o.marketplaceId);
  if (!m) throw new HttpError(400, "Pick an Amazon marketplace from the list.");
  const query = new URLSearchParams({ marketplaceIds: m.id, maxResultsPerPage: "100", includedData: "PROCEEDS,FULFILLMENT" });
  if (o.paginationToken) query.set("paginationToken", o.paginationToken);
  else query.set("lastUpdatedAfter", o.lastUpdatedAfter);
  const j = (await spGet("searchOrders", m.region, "/orders/2026-01-01/orders", query, o.maxWaitMs ?? 20_000)) as { orders?: unknown[]; pagination?: { nextToken?: unknown } } | undefined;
  const orders = (Array.isArray(j?.orders) ? j.orders : []).map(cleanOrder).filter((x): x is CleanOrder => !!x);
  const next = j?.pagination?.nextToken;
  return { orders, nextToken: typeof next === "string" && next ? next : null };
}

export type DayMetric = { day: string; units: number; orders: number; sales: number; currency: string };

/** Order metrics by day for the last `days` days [SALES], in UTC so the days match the imported orders. */
export async function orderMetricsByDay(o: { marketplaceId: string; days: number; maxWaitMs?: number }): Promise<DayMetric[]> {
  const m = marketplace(o.marketplaceId);
  if (!m) throw new HttpError(400, "Pick an Amazon marketplace from the list.");
  const end = new Date(channelClock().now());
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end.getTime() - o.days * 86_400_000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const query = new URLSearchParams({ marketplaceIds: m.id, interval: `${iso(start)}--${iso(end)}`, granularity: "Day", granularityTimeZone: "UTC" });
  const j = (await spGet("getOrderMetrics", m.region, "/sales/v1/orderMetrics", query, o.maxWaitMs ?? 20_000)) as { payload?: unknown[] } | undefined;
  const out: DayMetric[] = [];
  for (const raw of Array.isArray(j?.payload) ? j.payload : []) {
    const r = raw as Record<string, unknown>;
    const day = str(r.interval).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const sales = money(r.totalSales);
    out.push({ day, units: typeof r.unitCount === "number" ? r.unitCount : 0, orders: typeof r.orderCount === "number" ? r.orderCount : 0, sales: sales?.amount ?? 0, currency: sales?.currency ?? m.currency });
  }
  return out;
}
