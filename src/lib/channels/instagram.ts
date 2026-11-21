// Instagram API with Instagram Login (plan 8.19). Read on 21 Nov 2026:
//   [OVERVIEW] https://developers.facebook.com/documentation/instagram-platform/overview
//              Standard Access is the default and "If your app only serves your Instagram professional
//              account or an account you manage, Standard Access is all your app needs." Advanced Access
//              (accounts you do not own or manage) requires App Review and Business Verification.
//              Permissions with Instagram Login: instagram_business_basic, instagram_business_content_publish,
//              instagram_business_manage_comments (and _manage_messages, not used here).
//   [PUBLISH]  https://developers.facebook.com/documentation/instagram-platform/content-publishing
//              host graph.instagram.com; POST /<IG_ID>/media with image_url (and caption, alt_text) makes a
//              container; POST /<IG_ID>/media_publish with creation_id publishes it; GET /<container>?fields=status_code;
//              GET /<IG_ID>/content_publishing_limit. "We cURL media used in publishing attempts, so the media
//              must be hosted on a publicly accessible server at the time of the attempt." JPEG is the only
//              image format. 100 API-published posts per moving 24 hours (the carousel section says 50).
//   [COMMENTS] https://developers.facebook.com/documentation/instagram-platform/comment-moderation
//              GET /<IG_MEDIA_ID>/comments (id, text, timestamp); POST /<IG_COMMENT_ID>/replies with message.
//              Meta recommends webhooks to avoid rate limits; this app reads on request because it may have
//              no public address to receive them.
//   [REFRESH]  https://developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token
//              long-lived tokens last 60 days and can be refreshed once at least 24 hours old.
// The token is sent in the Authorization header (as in Meta's examples), never in a URL this app builds.
import { HttpError } from "@/lib/api/route";
import { getCredential } from "@/lib/settings";
import { ChannelError, channelFetch, igGraphBase, readJson, upstreamError } from "./http";
import { channelClock } from "./rateLimit";

export const IG_PUBLISH_LIMIT_24H = 100;

export async function igCredentials() {
  const [token, accountId] = await Promise.all([getCredential("instagram", "accessToken"), getCredential("instagram", "accountId")]);
  return token && accountId ? { token, accountId } : null;
}

export const IG_NOT_CONNECTED = "Instagram is not connected. Save the access token and the Instagram account ID in Admin, Credentials, then press Test connection.";

async function need() {
  const c = await igCredentials();
  if (!c) throw new HttpError(503, IG_NOT_CONNECTED);
  return c;
}

async function igCall<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const c = await need();
  const res = await channelFetch(
    "Instagram",
    `${igGraphBase()}${path}`,
    { method, headers: { authorization: `Bearer ${c.token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined },
    [c.token]
  );
  if (res.status !== 200) throw await upstreamError("Instagram", res, [c.token]);
  const j = await readJson<T>(res);
  if (j === undefined) throw new ChannelError(502, "Instagram answered with something that is not JSON.");
  return j;
}

export async function igMe(): Promise<{ id: string; username: string }> {
  const j = await igCall<{ user_id?: unknown; id?: unknown; username?: unknown }>("GET", "/me?fields=user_id,username");
  return { id: String(j.user_id ?? j.id ?? ""), username: String(j.username ?? "") };
}

/**
 * Why an image address will not work for Instagram, or null. Instagram fetches the image itself
 * [PUBLISH], so it must be a public https address, not this machine or a private network.
 */
export function publicImageProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return "The image address is not a web address.";
  }
  if (u.protocol !== "https:") return "The image address must start with https://.";
  if (u.username || u.password) return "The image address must not contain a user name or password.";
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateHost =
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".lan") ||
    !h.includes(".") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h === "::1" ||
    /^f[cd]/.test(h) ||
    /^fe80:/.test(h);
  if (privateHost) return "That address is on this machine or a private network. Instagram fetches the image from the internet, so it must be a public address.";
  if (!/\.jpe?g$/i.test(u.pathname)) return "Instagram publishes JPEG images only; the address should end in .jpg or .jpeg.";
  return null;
}

export async function igPublishingUsage(): Promise<{ used: number; limit: number } | null> {
  const c = await need();
  const j = await igCall<{ data?: { quota_usage?: unknown; config?: { quota_total?: unknown } }[] }>("GET", `/${encodeURIComponent(c.accountId)}/content_publishing_limit?fields=quota_usage,config`);
  const row = j.data?.[0];
  if (!row) return null;
  const used = typeof row.quota_usage === "number" ? row.quota_usage : 0;
  const limit = typeof row.config?.quota_total === "number" ? row.config.quota_total : IG_PUBLISH_LIMIT_24H;
  return { used, limit };
}

/**
 * Container, then publish [PUBLISH]. Waits for the container to be FINISHED (checked up to `checks`
 * times). Called only from src/lib/channels/send.ts, after every check there.
 */
export async function igPublishImage(o: { imageUrl: string; caption: string; altText?: string; checks?: number; waitMs?: number }): Promise<{ id: string; containerId: string }> {
  const c = await need();
  const usage = await igPublishingUsage().catch(() => null);
  if (usage && usage.used >= usage.limit) throw new HttpError(429, `Instagram allows ${usage.limit} published posts in 24 hours and this account has used them. Try again later.`);
  const container = await igCall<{ id?: unknown }>("POST", `/${encodeURIComponent(c.accountId)}/media`, {
    image_url: o.imageUrl,
    caption: o.caption,
    ...(o.altText ? { alt_text: o.altText } : {}),
  });
  if (!container.id) throw new ChannelError(502, "Instagram did not return a container id.");
  const containerId = String(container.id);
  const checks = o.checks ?? 10;
  for (let i = 0; i < checks; i++) {
    const s = await igCall<{ status_code?: unknown }>("GET", `/${encodeURIComponent(containerId)}?fields=status_code`);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new ChannelError(502, `Instagram could not use the image (container status ${s.status_code}). Check that the address opens the JPEG in a private browser window.`);
    if (i === checks - 1) throw new ChannelError(504, "Instagram had not finished reading the image. Nothing was published; try again in a minute.");
    await channelClock().sleep(o.waitMs ?? 2000);
  }
  const pub = await igCall<{ id?: unknown }>("POST", `/${encodeURIComponent(c.accountId)}/media_publish`, { creation_id: containerId });
  if (!pub.id) throw new ChannelError(502, "Instagram answered without the published media id. Check the account before publishing again.");
  return { id: String(pub.id), containerId };
}

export type IgComment = { id: string; text: string; author: string; at: string; mediaId: string; url: string };

/** Comments on the account's most recent media [COMMENTS]. */
export async function igRecentComments(mediaLimit = 10): Promise<IgComment[]> {
  const media = await igCall<{ data?: { id?: unknown; permalink?: unknown }[] }>("GET", `/me/media?fields=id,permalink&limit=${mediaLimit}`);
  const out: IgComment[] = [];
  for (const m of media.data ?? []) {
    if (!m.id) continue;
    const id = String(m.id);
    const comments = await igCall<{ data?: { id?: unknown; text?: unknown; username?: unknown; timestamp?: unknown }[] }>("GET", `/${encodeURIComponent(id)}/comments?fields=id,text,username,timestamp`);
    for (const c of comments.data ?? []) {
      if (!c.id) continue;
      out.push({ id: String(c.id), text: String(c.text ?? ""), author: String(c.username ?? ""), at: String(c.timestamp ?? ""), mediaId: id, url: typeof m.permalink === "string" ? m.permalink : "" });
    }
  }
  return out;
}

/** Replies to one comment [COMMENTS]. Called only from src/lib/channels/send.ts. */
export async function igReply(commentId: string, message: string): Promise<{ id: string }> {
  const j = await igCall<{ id?: unknown }>("POST", `/${encodeURIComponent(commentId)}/replies`, { message });
  if (!j.id) throw new ChannelError(502, "Instagram answered without the reply's id.");
  return { id: String(j.id) };
}
