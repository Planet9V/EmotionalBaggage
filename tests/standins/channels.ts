// Stand-ins for the three channel services (plan 8.17 to 8.19), written to the pages cited in
// src/lib/channels/amazon.ts, x.ts and instagram.ts (read 21 Nov 2026). Unverified details are marked.
//
// Amazon: Login with Amazon POST /auth/o2/token (form: grant_type=refresh_token, refresh_token,
// client_id, client_secret) -> { access_token, token_type, expires_in }; SP-API GET
// /orders/2026-01-01/orders and GET /sales/v1/orderMetrics with the x-amz-access-token header.
// Every order carries a buyer block and recipient address, as the real service would when asked, so
// tests can prove the app never stores them. 429 answers carry no Retry-After (unverified).
//
// X: POST /2/oauth2/token (authorization_code with code_verifier, or refresh_token), GET /2/users/me,
// POST /2/media/upload, POST /2/tweets, GET /2/users/:id/mentions. PKCE: the stand-in remembers the
// code_challenge given at "authorize" and checks the verifier against it (S256).
//
// Instagram: GET /me, GET /<id>/content_publishing_limit, POST /<id>/media, GET /<container>,
// POST /<id>/media_publish, GET /me/media, GET /<media>/comments, POST /<comment>/replies.
import { createHash } from "node:crypto";
import { bearer, json, startStandIn, type FailureOptions } from "./core";

// ---------------------------------------------------------------------------------------------
// Amazon

export type AmazonOrder = {
  orderId: string;
  createdTime: string;
  lastUpdatedTime: string;
  status: string;
  items: { asin: string; sku: string; qty: number; unit: string }[];
};

export type AmazonOptions = FailureOptions & {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  /** access tokens handed out so far; the newest is the valid one */
  issued: string[];
  expiresIn: number;
  orders: AmazonOrder[];
  pageSize: number;
  /** answer the next N SP-API calls with 429 */
  throttle: number;
  marketplaceId: string;
};

const AMZ: AmazonOptions = {
  refreshToken: "Atzr|stand-in-refresh-token-0001",
  clientId: "amzn1.application-oa2-client.standin0001",
  clientSecret: "amzn1.oa2-cs.v1.stand-in-secret-0001",
  issued: [],
  expiresIn: 3600,
  orders: [],
  pageSize: 100,
  throttle: 0,
  marketplaceId: "ATVPDKIKX0DER",
};

const money = (amount: string) => ({ amount, currencyCode: "USD" });

export function startAmazon(options?: Partial<AmazonOptions>) {
  return startStandIn<AmazonOptions>({ ...AMZ, issued: [], orders: [] }, (req, o) => {
    if (req.method === "POST" && req.path === "/auth/o2/token") {
      const b = new URLSearchParams(typeof req.body === "string" ? req.body : req.rawBody.toString());
      if (b.get("grant_type") !== "refresh_token" || b.get("refresh_token") !== o.refreshToken || b.get("client_id") !== o.clientId || b.get("client_secret") !== o.clientSecret) {
        return json(400, { error: "invalid_grant", error_description: "The request has an invalid grant parameter : refresh_token" });
      }
      const token = `Atza|stand-in-access-${o.issued.length + 1}-xxxxxxxx`;
      o.issued.push(token);
      return json(200, { access_token: token, refresh_token: o.refreshToken, token_type: "bearer", expires_in: o.expiresIn });
    }
    const token = String(req.headers["x-amz-access-token"] ?? "");
    if (!o.issued.length || token !== o.issued[o.issued.length - 1]) return json(403, { errors: [{ code: "Unauthorized", message: "Access to requested resource is denied. The access token you provided has expired." }] });
    if (o.throttle > 0) {
      o.throttle--;
      return json(429, { errors: [{ code: "QuotaExceeded", message: "You exceeded your quota for the requested resource." }] });
    }
    if (req.method === "GET" && req.path === "/orders/2026-01-01/orders") {
      if (req.query.includedData && /BUYER|RECIPIENT/.test(req.query.includedData)) return json(403, { errors: [{ code: "Unauthorized", message: "Restricted data requires a Restricted Data Token." }] });
      const start = req.query.paginationToken ? Number(req.query.paginationToken) : 0;
      if (!req.query.paginationToken && !req.query.lastUpdatedAfter && !req.query.createdAfter) return json(400, { errors: [{ code: "InvalidInput", message: "createdAfter or lastUpdatedAfter is required" }] });
      const since = req.query.lastUpdatedAfter ?? "";
      const all = o.orders.filter((x) => !since || x.lastUpdatedTime >= since);
      const page = all.slice(start, start + o.pageSize);
      return json(200, {
        orders: page.map((x) => ({
          orderId: x.orderId,
          createdTime: x.createdTime,
          lastUpdatedTime: x.lastUpdatedTime,
          salesChannel: { channelName: "AMAZON", marketplaceId: o.marketplaceId, marketplaceName: "Amazon.com" },
          // What a real answer could carry if BUYER or RECIPIENT were asked for; the app must drop it.
          buyer: { buyerName: "Jane Buyer", buyerEmail: "jane.buyer@marketplace.example" },
          recipient: { deliveryAddress: { name: "Jane Buyer", addressLine1: "1 Private Lane", city: "Springfield", postalCode: "12345" } },
          fulfillment: { fulfillmentStatus: x.status, fulfilledBy: "MERCHANT" },
          orderItems: x.items.map((i, k) => ({ orderItemId: `${x.orderId}-${k}`, quantityOrdered: i.qty, product: { asin: i.asin, sellerSku: i.sku, title: "Stand-in product", price: { unitPrice: money(i.unit) } } })),
        })),
        pagination: start + o.pageSize < all.length ? { nextToken: String(start + o.pageSize) } : {},
      });
    }
    if (req.method === "GET" && req.path === "/sales/v1/orderMetrics") {
      if (!req.query.interval || req.query.granularity !== "Day") return json(400, { errors: [{ code: "InvalidInput", message: "interval and granularity are required" }] });
      const days = new Map<string, { units: number; orders: number; sales: number }>();
      for (const x of o.orders) {
        const d = x.createdTime.slice(0, 10);
        const c = days.get(d) ?? { units: 0, orders: 0, sales: 0 };
        c.orders++;
        for (const i of x.items) {
          c.units += i.qty;
          c.sales += i.qty * Number(i.unit);
        }
        days.set(d, c);
      }
      return json(200, {
        payload: [...days.entries()].map(([d, c]) => ({ interval: `${d}T00:00Z--${d}T23:59Z`, unitCount: c.units, orderItemCount: c.units, orderCount: c.orders, averageUnitPrice: money("0"), totalSales: money(c.sales.toFixed(2)) })),
      });
    }
    return json(404, { errors: [{ code: "NotFound", message: `stand-in has no route ${req.method} ${req.path}` }] });
  }, options);
}

// ---------------------------------------------------------------------------------------------
// X

export type XOptions = FailureOptions & {
  clientId: string;
  clientSecret?: string;
  /** code -> code_challenge, as if the user approved on x.com */
  codes: Record<string, string>;
  access: string[];
  refresh: string;
  userId: string;
  username: string;
  posts: { id: string; text: string; media?: string[]; replyTo?: string }[];
  mentions: { id: string; text: string; author_id: string; created_at: string; conversation_id: string }[];
  /** answer the next N POST /2/tweets with 429 */
  throttlePosts: number;
};

const XD: XOptions = { clientId: "stand-in-x-client", codes: {}, access: [], refresh: "x-refresh-token-stand-in-0001", userId: "1500000000000000001", username: "baggageclaims", posts: [], mentions: [], throttlePosts: 0 };

const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function startX(options?: Partial<XOptions>) {
  return startStandIn<XOptions>({ ...XD, codes: {}, access: [], posts: [], mentions: [] }, (req, o) => {
    if (req.method === "POST" && req.path === "/2/oauth2/token") {
      const b = new URLSearchParams(req.rawBody.toString());
      const auth = String(req.headers.authorization ?? "");
      const basic = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString() : "";
      const clientOk = o.clientSecret ? basic === `${o.clientId}:${o.clientSecret}` : b.get("client_id") === o.clientId;
      if (!clientOk) return json(401, { error: "unauthorized_client", error_description: "Missing valid authorization header" });
      const issue = () => {
        const t = `x-access-${o.access.length + 1}-stand-in-token`;
        o.access.push(t);
        o.refresh = `x-refresh-${o.access.length}-stand-in-token`;
        return json(200, { token_type: "bearer", expires_in: 7200, access_token: t, scope: "tweet.read tweet.write users.read media.write offline.access", refresh_token: o.refresh });
      };
      if (b.get("grant_type") === "authorization_code") {
        const code = b.get("code") ?? "";
        const challenge = o.codes[code];
        if (!challenge) return json(400, { error: "invalid_request", error_description: "Value passed for the authorization code was invalid." });
        delete o.codes[code];
        if (s256(b.get("code_verifier") ?? "") !== challenge) return json(400, { error: "invalid_request", error_description: "Value passed for the code verifier did not match." });
        return issue();
      }
      if (b.get("grant_type") === "refresh_token") {
        if (b.get("refresh_token") !== o.refresh) return json(400, { error: "invalid_request", error_description: "Value passed for the token was invalid." });
        return issue();
      }
      return json(400, { error: "unsupported_grant_type" });
    }
    const tok = bearer(req.headers);
    if (!tok || tok !== o.access[o.access.length - 1]) return json(401, { title: "Unauthorized", type: "about:blank", status: 401, detail: "Unauthorized" });
    if (req.method === "GET" && req.path === "/2/users/me") return json(200, { data: { id: o.userId, name: "Stand-in", username: o.username } });
    if (req.method === "POST" && req.path === "/2/media/upload") {
      const b = req.body as { media?: string; media_category?: string };
      if (!b?.media || b.media_category !== "tweet_image") return json(400, { errors: [{ message: "media and media_category are required" }] });
      return json(200, { data: { id: `17${String(Date.now()).slice(-10)}${o.posts.length}`, media_key: "3_stand-in", size: Buffer.from(b.media, "base64").length } });
    }
    if (req.method === "POST" && req.path === "/2/tweets") {
      if (o.throttlePosts > 0) {
        o.throttlePosts--;
        return json(429, { title: "Too Many Requests", detail: "Too Many Requests", type: "about:blank", status: 429 });
      }
      const b = req.body as { text?: string; media?: { media_ids?: string[] }; reply?: { in_reply_to_tweet_id?: string } };
      if (!b?.text) return json(400, { errors: [{ message: "text is required" }] });
      const id = String(BigInt("1900000000000000000") + BigInt(o.posts.length + 1));
      o.posts.push({ id, text: b.text, media: b.media?.media_ids, replyTo: b.reply?.in_reply_to_tweet_id });
      return json(201, { data: { id, text: b.text, edit_history_tweet_ids: [id] } });
    }
    const m = /^\/2\/users\/([0-9]+)\/mentions$/.exec(req.path);
    if (req.method === "GET" && m) {
      const since = req.query.since_id ? BigInt(req.query.since_id) : BigInt(0);
      const data = o.mentions.filter((x) => BigInt(x.id) > since);
      return json(200, data.length ? { data, includes: { users: data.map((x) => ({ id: x.author_id, username: `user${x.author_id.slice(-3)}`, name: "Someone" })) }, meta: { result_count: data.length } } : { meta: { result_count: 0 } });
    }
    return json(404, { title: "Not Found Error", detail: `stand-in has no route ${req.method} ${req.path}` });
  }, options);
}

// ---------------------------------------------------------------------------------------------
// Instagram

export type IgOptions = FailureOptions & {
  token: string;
  accountId: string;
  username: string;
  quotaUsage: number;
  /** status_code answers for a new container, in order */
  containerStates: string[];
  published: { id: string; image_url: string; caption: string }[];
  media: { id: string; permalink: string; comments: { id: string; text: string; username: string; timestamp: string }[] }[];
  replies: { commentId: string; message: string; id: string }[];
};

const IGD: IgOptions = { token: "IGAA-stand-in-long-lived-token-0001", accountId: "17841400000000001", username: "baggageclaims", quotaUsage: 0, containerStates: ["IN_PROGRESS", "FINISHED"], published: [], media: [], replies: [] };

export function startInstagram(options?: Partial<IgOptions>) {
  const containers = new Map<string, { image_url: string; caption: string; checks: number }>();
  return startStandIn<IgOptions>({ ...IGD, published: [], media: [], replies: [] }, (req, o) => {
    if (bearer(req.headers) !== o.token) return json(400, { error: { message: "Invalid OAuth access token - Cannot parse access token", type: "OAuthException", code: 190 } });
    const p = req.path.replace(/^\/v[0-9.]+/, "");
    if (req.method === "GET" && p === "/me") return json(200, { user_id: o.accountId, username: o.username, id: o.accountId });
    if (req.method === "GET" && p === `/${o.accountId}/content_publishing_limit`) return json(200, { data: [{ quota_usage: o.quotaUsage, config: { quota_total: 100, quota_duration: 86400 } }] });
    if (req.method === "POST" && p === `/${o.accountId}/media`) {
      const b = req.body as { image_url?: string; caption?: string };
      if (!b?.image_url) return json(400, { error: { message: "image_url is required", code: 100 } });
      const id = `1790000000000${containers.size + 1}`;
      containers.set(id, { image_url: b.image_url, caption: b.caption ?? "", checks: 0 });
      return json(200, { id });
    }
    const cont = containers.get(p.slice(1));
    if (req.method === "GET" && cont) {
      const s = o.containerStates[Math.min(cont.checks, o.containerStates.length - 1)];
      cont.checks++;
      return json(200, { status_code: s, id: p.slice(1) });
    }
    if (req.method === "POST" && p === `/${o.accountId}/media_publish`) {
      const b = req.body as { creation_id?: string };
      const c = b?.creation_id ? containers.get(b.creation_id) : undefined;
      if (!c) return json(400, { error: { message: "creation_id is invalid", code: 100 } });
      const id = `1800000000000${o.published.length + 1}`;
      o.published.push({ id, image_url: c.image_url, caption: c.caption });
      return json(200, { id });
    }
    if (req.method === "GET" && p === "/me/media") return json(200, { data: o.media.map((m) => ({ id: m.id, permalink: m.permalink })) });
    const cm = /^\/([0-9]+)\/comments$/.exec(p);
    if (req.method === "GET" && cm) return json(200, { data: o.media.find((m) => m.id === cm[1])?.comments ?? [] });
    const rp = /^\/([0-9]+)\/replies$/.exec(p);
    if (req.method === "POST" && rp) {
      const b = req.body as { message?: string };
      if (!b?.message) return json(400, { error: { message: "message is required", code: 100 } });
      const id = `1787${o.replies.length + 1}`;
      o.replies.push({ commentId: rp[1], message: b.message, id });
      return json(200, { id });
    }
    return json(404, { error: { message: `stand-in has no route ${req.method} ${req.path}`, code: 803 } });
  }, options);
}
