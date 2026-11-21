// X API v2 (plan 8.18). Read on 21 Nov 2026:
//   [PKCE]    https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
//             authorize at https://x.com/i/oauth2/authorize with response_type=code, client_id, redirect_uri
//             (exact match with the app's callback URLs), scope, state (up to 500 characters),
//             code_challenge and code_challenge_method (S256 or plain). The code must be exchanged within
//             30 seconds. Token: POST https://api.x.com/2/oauth2/token (form). Access tokens last two hours;
//             offline.access gives a refresh token (grant_type=refresh_token). Confidential clients
//             (Web App, Automated App) authenticate with the client secret in a Basic Authorization header;
//             public clients send client_id in the body. Scopes used: tweet.read tweet.write users.read
//             media.write offline.access.
//   [POST]    https://docs.x.com/x-api/posts/create-post : POST /2/tweets { text, media: { media_ids },
//             reply: { in_reply_to_tweet_id } }; answers data.id and data.text.
//   [MEDIA]   https://docs.x.com/x-api/media/upload-media : POST /2/media/upload, media base64 in JSON,
//             media_category tweet_image (JPG, PNG, GIF or WEBP, up to 5 MB); answers data.id. Scope media.write.
//             The Create Post schema allows up to 20 media_ids; this app sends at most 4 images, the number
//             X's own posting screens accept (help.x.com, "How to post photos"; the help page was not read here).
//   [MENTION] https://docs.x.com/x-api/users/get-mentions : GET /2/users/{id}/mentions with since_id,
//             max_results, tweet.fields, expansions=author_id, user.fields=username.
//   [LIMITS]  https://docs.x.com/x-api/fundamentals/rate-limits : POST /2/tweets 100 per 15 minutes per user;
//             GET /2/users/:id/mentions 300 per 15 minutes per user; POST /2/media/upload 500 per 15 minutes.
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "@/lib/api/route";
import { providerDef } from "@/lib/admin/providers";
import { saveCredentials } from "@/lib/admin/credentials";
import { getCredential } from "@/lib/settings";
import { getSecretFor } from "@/lib/secretOrigin";
import { ChannelError, channelFetch, readJson, upstreamError, xApiBase, xAuthorizeUrl } from "./http";
import { limited, TokenBucket, channelClock } from "./rateLimit";
import { saveXAccount, xAccount, type XAccount } from "./state";

export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];
export const X_MAX_IMAGES = 4;
export const X_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const X_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Per-user rates from [LIMITS], as token buckets (rate per second, burst). */
const BUCKETS = {
  post: () => new TokenBucket(100 / 900, 100),
  mentions: () => new TokenBucket(300 / 900, 300),
  media: () => new TokenBucket(500 / 900, 500),
};
let buckets: { post: TokenBucket; mentions: TokenBucket; media: TokenBucket } | null = null;
const bucket = (k: keyof typeof BUCKETS) => (buckets ??= { post: BUCKETS.post(), mentions: BUCKETS.mentions(), media: BUCKETS.media() })[k];

// ---------------------------------------------------------------------------------------------
// OAuth 2.0 with PKCE. A started sign-in is kept in this process's memory for ten minutes, bound to
// the session that started it, and used once. The verifier never leaves the server.

type Pending = { verifier: string; redirectUri: string; sessionId: string; expires: number };
const pending = new Map<string, Pending>();
const PENDING_MS = 10 * 60_000;

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const challengeOf = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

export function resetX() {
  pending.clear();
  buckets = null;
}

export async function xClient() {
  const [clientId, clientSecret, callbackUrl] = await Promise.all([getCredential("x", "clientId"), getSecretFor("x", "clientSecret", xApiBase()), getCredential("x", "callbackUrl")]);
  return { clientId, clientSecret, callbackUrl };
}

/**
 * This app's address as the browser sees it: the Host header (or a proxy's X-Forwarded-Host and
 * X-Forwarded-Proto), not req.url, which the standalone server fills with its own listening name.
 */
export function browserOrigin(req: Request): string {
  const u = new URL(req.url);
  const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = fwdHost || req.headers.get("host") || u.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || u.protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}

/** Where X sends the browser back: the saved callback address, else this app's own address. */
export function callbackFor(origin: string, saved: string | null) {
  return saved?.trim() || `${origin.replace(/\/+$/, "")}/api/channels/x/callback`;
}

/** Starts a sign-in: the authorize URL to open. */
export async function startXSignIn(sessionId: string, origin: string): Promise<{ url: string; redirectUri: string }> {
  const { clientId, callbackUrl } = await xClient();
  if (!clientId) throw new HttpError(400, "Save the X client ID in Admin, Credentials first. It is on the Keys and tokens page of your app in the X Developer Console.");
  const now = channelClock().now();
  for (const [k, p] of pending) if (p.expires < now) pending.delete(k);
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(48)); // 64 characters, within RFC 7636's 43 to 128
  const redirectUri = callbackFor(origin, callbackUrl);
  pending.set(state, { verifier, redirectUri, sessionId, expires: now + PENDING_MS });
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: challengeOf(verifier),
    code_challenge_method: "S256",
  });
  return { url: `${xAuthorizeUrl()}?${q.toString()}`, redirectUri };
}

/** Takes (and forgets) a started sign-in. A wrong, expired or reused state, or another session, is refused. */
export function takePending(state: string, sessionId: string): Pending {
  const p = pending.get(state);
  if (!p) throw new HttpError(400, "This sign-in with X was not started here, was already used or has expired. Start it again from Admin.");
  pending.delete(state);
  if (p.sessionId !== sessionId) throw new HttpError(400, "This sign-in with X was started in another session. Start it again from Admin.");
  if (p.expires < channelClock().now()) throw new HttpError(400, "This sign-in with X expired. Start it again from Admin.");
  return p;
}

type TokenAnswer = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown };

async function tokenRequest(form: Record<string, string>): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number | null; scope: string }> {
  const { clientId, clientSecret } = await xClient();
  if (!clientId) throw new HttpError(400, "Save the X client ID in Admin, Credentials first.");
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(form);
  if (clientSecret) headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  else body.set("client_id", clientId);
  const secrets = [clientSecret, form.code, form.refresh_token, form.code_verifier];
  const res = await channelFetch("X", `${xApiBase()}/2/oauth2/token`, { method: "POST", headers, body: body.toString() }, secrets);
  if (res.status !== 200) throw await upstreamError("X", res, secrets);
  const j = await readJson<TokenAnswer>(res);
  if (typeof j?.access_token !== "string" || !j.access_token) throw new ChannelError(502, "X answered without an access token.");
  const ttl = typeof j.expires_in === "number" ? j.expires_in : null;
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === "string" && j.refresh_token ? j.refresh_token : null,
    expiresAt: ttl ? channelClock().now() + ttl * 1000 : null,
    scope: typeof j.scope === "string" ? j.scope : "",
  };
}

async function saveTokens(t: { accessToken: string; refreshToken: string | null }) {
  const def = providerDef("x")!;
  const values: [string, string][] = [["accessToken", t.accessToken]];
  if (t.refreshToken) values.push(["refreshToken", t.refreshToken]);
  await saveCredentials(def, values);
}

/** Finishes a sign-in: exchanges the code, saves the tokens as credentials, reads who signed in. */
export async function finishXSignIn(code: string, p: Pending): Promise<XAccount> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: p.redirectUri, code_verifier: p.verifier });
  await saveTokens(t);
  const me = await xGet<{ data?: { id?: string; username?: string } }>("/2/users/me", t.accessToken, [t.accessToken]);
  const account: XAccount = {
    userId: String(me?.data?.id ?? ""),
    username: String(me?.data?.username ?? ""),
    expiresAt: t.expiresAt,
    scope: t.scope,
    connectedAt: new Date(channelClock().now()).toISOString(),
  };
  await saveXAccount(account);
  return account;
}

/** The saved access token, refreshed first when it has expired (or is about to) and a refresh token is saved. */
export async function xAccessToken(force = false): Promise<string> {
  const [token, refresh, account] = await Promise.all([getSecretFor("x", "accessToken", xApiBase()), getSecretFor("x", "refreshToken", xApiBase()), xAccount()]);
  if (!token && !refresh) throw new HttpError(503, "X is not connected. Save the client ID in Admin, Credentials, then press Connect X account.");
  const expired = account?.expiresAt != null && account.expiresAt - 60_000 < channelClock().now();
  if ((force || expired || !token) && refresh) {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
    await saveTokens({ accessToken: t.accessToken, refreshToken: t.refreshToken ?? refresh });
    if (account) await saveXAccount({ ...account, expiresAt: t.expiresAt, scope: t.scope || account.scope });
    return t.accessToken;
  }
  if (!token) throw new HttpError(503, "X is not connected.");
  return token;
}

async function xGet<T>(path: string, token: string, secrets: (string | null)[]): Promise<T | undefined> {
  const res = await channelFetch("X", `${xApiBase()}${path}`, { headers: { authorization: `Bearer ${token}` } }, secrets);
  if (res.status !== 200) throw await upstreamError("X", res, secrets);
  return readJson<T>(res);
}

/** Calls X with the saved token; on 401 refreshes once and tries again. */
async function withToken(send: (token: string) => Promise<Response>): Promise<{ res: Response; token: string }> {
  let token = await xAccessToken();
  let res = await send(token);
  if (res.status === 401 && (await getSecretFor("x", "refreshToken", xApiBase()))) {
    await res.body?.cancel().catch(() => undefined);
    token = await xAccessToken(true);
    res = await send(token);
  }
  return { res, token };
}

export async function xMe(): Promise<{ id: string; username: string }> {
  const { res, token } = await withToken((t) => channelFetch("X", `${xApiBase()}/2/users/me`, { headers: { authorization: `Bearer ${t}` } }, [t]));
  if (res.status !== 200) throw await upstreamError("X", res, [token]);
  const j = await readJson<{ data?: { id?: string; username?: string } }>(res);
  if (!j?.data?.id) throw new ChannelError(502, "X answered, but not with an account.");
  return { id: String(j.data.id), username: String(j.data.username ?? "") };
}

/** Uploads one image [MEDIA]. */
export async function xUploadImage(bytes: Buffer, mime: string): Promise<string> {
  if (!X_IMAGE_TYPES.has(mime)) throw new HttpError(400, `X takes JPG, PNG, GIF or WEBP images; this file is ${mime}.`);
  if (bytes.length > X_IMAGE_MAX_BYTES) throw new HttpError(400, "X takes images up to 5 MB; this file is larger.");
  const body = JSON.stringify({ media: bytes.toString("base64"), media_category: "tweet_image" });
  const { res, token } = await withToken((t) =>
    limited(bucket("media"), "X media upload", () => channelFetch("X", `${xApiBase()}/2/media/upload`, { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body }, [t]))
  );
  if (res.status !== 200 && res.status !== 201) throw await upstreamError("X", res, [token]);
  const j = await readJson<{ data?: { id?: unknown } }>(res);
  if (!j?.data?.id) throw new ChannelError(502, "X accepted the image but gave no media id.");
  return String(j.data.id);
}

/** Creates one post or reply [POST]. Called only from src/lib/channels/send.ts, after every check there. */
export async function xCreatePost(text: string, opts: { mediaIds?: string[]; replyTo?: string } = {}): Promise<{ id: string; url: string }> {
  const payload: Record<string, unknown> = { text };
  if (opts.mediaIds?.length) payload.media = { media_ids: opts.mediaIds.slice(0, X_MAX_IMAGES) };
  if (opts.replyTo) payload.reply = { in_reply_to_tweet_id: opts.replyTo };
  const { res, token } = await withToken((t) =>
    limited(bucket("post"), "Posting to X", () => channelFetch("X", `${xApiBase()}/2/tweets`, { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify(payload) }, [t]), { retries: 0 })
  );
  if (res.status !== 201 && res.status !== 200) throw await upstreamError("X", res, [token]);
  const j = await readJson<{ data?: { id?: unknown } }>(res);
  if (!j?.data?.id) throw new ChannelError(502, "X answered without the new post's id. Check your X profile before sending again.");
  const id = String(j.data.id);
  return { id, url: `https://x.com/i/web/status/${id}` };
}

export type Mention = { id: string; text: string; author: string; at: string; conversationId: string; url: string };

/** Mentions of the signed-in account since a post id [MENTION]. */
export async function xMentions(userId: string, sinceId?: string): Promise<Mention[]> {
  const q = new URLSearchParams({ max_results: "50", "tweet.fields": "created_at,author_id,conversation_id", expansions: "author_id", "user.fields": "username" });
  if (sinceId) q.set("since_id", sinceId);
  const { res, token } = await withToken((t) =>
    limited(bucket("mentions"), "Reading X mentions", () => channelFetch("X", `${xApiBase()}/2/users/${encodeURIComponent(userId)}/mentions?${q}`, { headers: { authorization: `Bearer ${t}` } }, [t]))
  );
  if (res.status !== 200) throw await upstreamError("X", res, [token]);
  const j = await readJson<{ data?: Record<string, unknown>[]; includes?: { users?: { id?: string; username?: string }[] } }>(res);
  const users = new Map((j?.includes?.users ?? []).map((u) => [String(u.id), String(u.username ?? "")]));
  return (j?.data ?? []).map((t) => {
    const id = String(t.id ?? "");
    return { id, text: String(t.text ?? ""), author: users.get(String(t.author_id ?? "")) ?? "", at: String(t.created_at ?? ""), conversationId: String(t.conversation_id ?? ""), url: `https://x.com/i/web/status/${id}` };
  }).filter((m) => m.id);
}
