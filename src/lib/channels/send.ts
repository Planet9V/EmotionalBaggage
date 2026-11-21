// The one way anything leaves this app for X or Instagram (plan 8.18, 8.19). Every send is one row,
// pressed by the user, after a confirmation that names what and where:
//   - the row is an items row (a draft in the drafts table can never be sent: nothing here reads drafts);
//   - a post must be "approved" or "scheduled" in Marketing, Social; a reply must be "approved" in Replies;
//   - the confirmation carries the channel, the row id and the SHA-256 of the exact text the user saw
//     (from preview()); a text changed since is refused;
//   - X needs the current cost statement acknowledged; Instagram needs a public JPEG address;
//   - a row already sent, or being sent, is refused, so a double click cannot post twice.
// The confirmation, the send and any failure are recorded in the concept's activity and the audit log,
// with the channel, the row, the text's hash and the id the service gave back. Never a token.
import { plainMessage } from "@/lib/net/plain";
import { sha256 } from "@/lib/hash";
import type { PoolClient } from "pg";
import { z } from "zod";
import { currentActor } from "@/lib/actor";
import { HttpError, notFound } from "@/lib/api/route";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import type { Item } from "@/lib/types";
import { CHANNEL } from "./schemas";
import { channelOf, type SendChannel } from "./channelName";
import { channelName } from "./registry";
import { igPublishImage, igReply, publicImageProblem } from "./instagram";
import { postCost, X_COST_STATEMENT } from "./xCost";
import { xCreatePost, xUploadImage, X_MAX_IMAGES } from "./x";
import { xCostAck, xAccount } from "./state";
import { ChannelError } from "./http";

export type SendKind = "post" | "reply";


const SECTION: Record<SendKind, string> = { post: CHANNEL.social, reply: CHANNEL.replies };
const SENDABLE: Record<SendKind, Set<string>> = { post: new Set(["approved", "scheduled"]), reply: new Set(["approved"]) };
const DONE_STATUS: Record<SendKind, string> = { post: "posted", reply: "sent" };
const SENDING_STALE_MS = 5 * 60_000;

const confirmSchema = z
  .object({
    channel: z.enum(["x", "instagram"]),
    itemId: z.number().int().positive(),
    textSha256: z.string().regex(/^[0-9a-f]{64}$/, "must be the SHA-256 the preview gave"),
    imageUrl: z.string().max(2000).optional(),
  })
  .strict();

export const sendBody = z
  .object({ projectId: z.string().min(1).max(80), kind: z.enum(["post", "reply"]), itemId: z.number().int().positive(), confirm: confirmSchema })
  .strict();
export type SendBody = z.infer<typeof sendBody>;

export type Preview = {
  kind: SendKind;
  itemId: number;
  channel: SendChannel;
  text: string;
  textSha256: string;
  status: string;
  sendable: boolean;
  /** why it cannot be sent now, or "" */
  blocked: string;
  account: string | null;
  cost: { usd: number; rule: string; statementVersion: string; read: string; url: string; acknowledged: boolean } | null;
  imageUrl: string | null;
  imageProblem: string | null;
  media: { shotKey: string; fileId: number | null; ok: boolean; problem: string }[];
  replyTo: string | null;
  /** an earlier send may have reached the service: the user must check the channel and record what they found */
  outcomeUnknown?: boolean;
};

async function rowOf(projectId: string, kind: SendKind, itemId: number, c?: PoolClient): Promise<Item> {
  const sql = `SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3${c ? " FOR UPDATE" : ""}`;
  const args = [itemId, projectId, SECTION[kind]];
  const rows = c ? (await c.query<ItemRow>(sql, args)).rows : await q<ItemRow>(sql, args);
  if (!rows[0]) throw notFound(kind === "post" ? "That post" : "That reply");
  return toItem(rows[0]);
}

/** The images a post names (imagery shot keys), each with its file if one is attached. */
async function mediaOf(projectId: string, item: Item) {
  const keys = Array.isArray(item.data.mediaShotKeys) ? (item.data.mediaShotKeys as unknown[]).filter((k): k is string => typeof k === "string") : [];
  if (!keys.length) return [];
  const shots = await q<{ key: string; file_id: string | null; mime: string | null; size: number | null }>(
    `SELECT i.data->>'shotKey' AS key, f.id AS file_id, f.mime, f.size FROM items i
     LEFT JOIN files f ON f.project_id = i.project_id AND f.id = NULLIF(i.data->>'fileId','')::bigint
     WHERE i.project_id=$1 AND i.section=$2 AND i.data->>'shotKey' = ANY($3)`,
    [projectId, CHANNEL.imagery, keys]
  );
  return keys.map((k) => {
    const s = shots.find((x) => x.key === k && x.file_id);
    if (!s) return { shotKey: k, fileId: null, ok: false, problem: `The shot "${k}" has no file in Imagery.` };
    return { shotKey: k, fileId: Number(s.file_id), ok: true, problem: "" };
  });
}

const sendingFresh = (data: Record<string, unknown>) => {
  const s = data.sending as { at?: string } | undefined;
  return !!s?.at && Date.now() - new Date(s.at).getTime() < SENDING_STALE_MS;
};

/**
 * True when an earlier send may or may not have reached the service (robustness review S9): it timed out or
 * the connection dropped mid-request (sendUnknown), or a `sending` marker is older than five minutes (the app
 * stopped mid-send). Such a row is never sent again until the user records, by a separate action, what the
 * channel shows (resolveUnknown).
 */
const outcomeUnknown = (data: Record<string, unknown>) => !!data.sendUnknown || (!!data.sending && !sendingFresh(data));

const UNKNOWN_OUTCOME = "Outcome unknown: check the channel. The last send may have reached it. Look at the account, then record whether it was posted before sending again.";

/** What would be sent, with its hash and every reason it could not be sent now. */
export async function preview(projectId: string, kind: SendKind, itemId: number): Promise<Preview> {
  const item = await rowOf(projectId, kind, itemId);
  const channel = channelOf(item.data.channel);
  if (!channel) throw new HttpError(400, `This row's channel is "${String(item.data.channel ?? "")}". Only X and Instagram can be sent from this app.`);
  const text = item.body;
  const reasons: string[] = [];
  if (!SENDABLE[kind].has(item.status)) reasons.push(`Only an approved ${kind} can be sent; this one is "${item.status}".`);
  if (item.data.sent) reasons.push("It was already sent.");
  if (sendingFresh(item.data)) reasons.push("It is being sent right now.");
  if (outcomeUnknown(item.data)) reasons.push(UNKNOWN_OUTCOME);
  if (!text.trim()) reasons.push("It has no text.");
  let cost: Preview["cost"] = null;
  let account: string | null = null;
  if (channel === "x") {
    const [ack, acct] = await Promise.all([xCostAck(), xAccount()]);
    const c = postCost(text);
    cost = { ...c, statementVersion: X_COST_STATEMENT.version, read: X_COST_STATEMENT.read, url: X_COST_STATEMENT.url, acknowledged: ack?.version === X_COST_STATEMENT.version };
    if (!cost.acknowledged) reasons.push("Read X's cost statement and tick that you have read it first.");
    account = acct?.username ? `@${acct.username}` : null;
  }
  const imageUrl = typeof item.data.publicImageUrl === "string" && item.data.publicImageUrl ? item.data.publicImageUrl : null;
  const imageProblem = channel === "instagram" && kind === "post" ? (imageUrl ? publicImageProblem(imageUrl) : "Instagram needs a public address for the image (see below).") : null;
  if (imageProblem) reasons.push(imageProblem);
  const media = channel === "x" && kind === "post" ? await mediaOf(projectId, item) : [];
  for (const m of media) if (!m.ok) reasons.push(m.problem);
  if (media.length > X_MAX_IMAGES) reasons.push(`X takes at most ${X_MAX_IMAGES} images; this post names ${media.length}.`);
  const replyTo = typeof item.data.replyTo === "string" && item.data.replyTo ? item.data.replyTo : null;
  if (kind === "reply" && !replyTo) reasons.push("It does not say which mention or comment it answers.");
  return {
    kind,
    itemId,
    channel,
    text,
    textSha256: sha256(text),
    status: item.status,
    sendable: reasons.length === 0,
    blocked: reasons.join(" "),
    account,
    cost,
    imageUrl,
    imageProblem,
    media,
    replyTo,
    outcomeUnknown: outcomeUnknown(item.data),
  };
}

export type SendResult = { ok: true; id: string; url?: string; item: Item };

export async function send(b: SendBody): Promise<SendResult> {
  const { projectId, kind, itemId, confirm } = b;
  if (confirm.itemId !== itemId) throw new HttpError(400, "The confirmation names a different row from the one being sent.");
  const actor = currentActor() || "unknown";

  // 1. Check and claim the row, and record the confirmation, in one transaction.
  const claimed = await tx(async (c) => {
    const item = await rowOf(projectId, kind, itemId, c);
    const channel = channelOf(item.data.channel);
    if (!channel) throw new HttpError(400, "Only X and Instagram can be sent from this app.");
    if (channel !== confirm.channel) throw new HttpError(409, `The confirmation was for ${channelName(confirm.channel)}, but this row is for ${channelName(channel)}.`);
    if (!SENDABLE[kind].has(item.status)) throw new HttpError(409, `Only an approved ${kind} can be sent; this one is "${item.status}". Nothing was sent.`);
    if (item.data.sent) throw new HttpError(409, "This was already sent. Nothing was sent again.");
    if (sendingFresh(item.data)) throw new HttpError(409, "This is being sent right now. Wait for it to finish.");
    if (outcomeUnknown(item.data)) throw new HttpError(409, `${UNKNOWN_OUTCOME} Nothing was sent.`, { outcomeUnknown: true });
    if (!item.body.trim()) throw new HttpError(400, "There is no text to send.");
    if (sha256(item.body) !== confirm.textSha256) throw new HttpError(409, "The text changed after you confirmed. Open it again and confirm the text as it is now.");
    let imageUrl: string | null = null;
    if (channel === "x") {
      const ack = await xCostAck();
      if (ack?.version !== X_COST_STATEMENT.version) throw new HttpError(409, "Read X's current cost statement and tick that you have read it before sending.", { needsCostAck: true });
    } else if (kind === "post") {
      imageUrl = (confirm.imageUrl ?? "").trim();
      const saved = typeof item.data.publicImageUrl === "string" ? item.data.publicImageUrl : "";
      if (!imageUrl || imageUrl !== saved) throw new HttpError(409, "Confirm the image address saved on the post.");
      const problem = publicImageProblem(imageUrl);
      if (problem) throw new HttpError(400, problem);
    }
    if (kind === "reply" && !(typeof item.data.replyTo === "string" && item.data.replyTo)) throw new HttpError(400, "This reply does not say which mention or comment it answers.");
    await c.query("UPDATE items SET data = data || $2::jsonb, updated_at = now() WHERE id=$1", [itemId, JSON.stringify({ sending: { at: new Date().toISOString(), by: actor } })]);
    const where = channelName(channel);
    await logEventIn(c, projectId, `channel.${kind}.confirmed`, `${actor} confirmed sending the ${kind} "${item.title}" to ${where}`, {
      channel,
      kind,
      itemId,
      textSha256: confirm.textSha256,
      ...(imageUrl ? { imageUrl } : {}),
      ...(channel === "x" ? { costStatement: X_COST_STATEMENT.version, costUsd: postCost(item.body).usd } : {}),
    });
    return { item, channel, imageUrl };
  });

  // 2. Send, outside any transaction.
  const { item, channel } = claimed;
  let result: { id: string; url?: string };
  try {
    if (channel === "x") {
      const mediaIds: string[] = [];
      if (kind === "post") {
        const media = await mediaOf(projectId, item);
        if (media.length > X_MAX_IMAGES) throw new HttpError(400, `X takes at most ${X_MAX_IMAGES} images.`);
        for (const m of media) {
          if (!m.ok || m.fileId === null) throw new HttpError(400, m.problem);
          const f = await q<{ bytes: Buffer; mime: string }>("SELECT bytes, mime FROM files WHERE id=$1 AND project_id=$2", [m.fileId, projectId]);
          if (!f[0]) throw new HttpError(400, `The file for "${m.shotKey}" is gone.`);
          mediaIds.push(await xUploadImage(f[0].bytes, f[0].mime));
        }
      }
      result = await xCreatePost(item.body, { mediaIds, replyTo: kind === "reply" ? String(item.data.replyTo) : undefined });
    } else if (kind === "post") {
      const alt = typeof item.data.altText === "string" ? item.data.altText : undefined;
      const r = await igPublishImage({ imageUrl: claimed.imageUrl!, caption: item.body, altText: alt });
      result = { id: r.id };
    } else {
      result = await igReply(String(item.data.replyTo), item.body);
    }
  } catch (e) {
    const message = plainMessage(e);
    const where = channelName(channel);
    // A time-out or a connection dropped mid-request may still have posted: record that the outcome is unknown,
    // which blocks a re-send until the user checks the channel. A refusal the service answered is a plain failure.
    const unknown = e instanceof ChannelError && e.unknownOutcome;
    await tx(async (c) => {
      if (unknown) {
        await c.query("UPDATE items SET data = (data - 'sending') || $2::jsonb, updated_at = now() WHERE id=$1", [itemId, JSON.stringify({ sendUnknown: { at: new Date().toISOString(), message } })]);
        await logEventIn(c, projectId, `channel.${kind}.unknown`, `Sending the ${kind} "${item.title}" to ${where}: outcome unknown (${message})`, { channel, kind, itemId, textSha256: confirm.textSha256 });
      } else {
        await c.query("UPDATE items SET data = (data - 'sending') || $2::jsonb, updated_at = now() WHERE id=$1", [itemId, JSON.stringify({ sendError: { at: new Date().toISOString(), message } })]);
        await logEventIn(c, projectId, `channel.${kind}.failed`, `Sending the ${kind} "${item.title}" to ${where} failed: ${message}`, { channel, kind, itemId, textSha256: confirm.textSha256 });
      }
    });
    if (unknown) throw new HttpError(504, `${message} ${UNKNOWN_OUTCOME}`, { outcomeUnknown: true });
    throw e;
  }

  // 3. Record what the service gave back.
  const sent = { id: result.id, at: new Date().toISOString(), ...(result.url ? { url: result.url } : {}), by: actor };
  const updated = await tx(async (c) => {
    const r = await c.query<ItemRow>(
      `UPDATE items SET status=$2, data = (((data - 'sending') - 'sendError') - 'sendUnknown') || $3::jsonb, updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`,
      [itemId, DONE_STATUS[kind], JSON.stringify({ sent })]
    );
    if (kind === "reply" && typeof item.data.answers === "number") {
      await c.query("UPDATE items SET status='answered', updated_at=now() WHERE id=$1 AND project_id=$2 AND section=$3", [item.data.answers, projectId, CHANNEL.inbox]);
    }
    await logEventIn(c, projectId, `channel.${kind}.sent`, `Sent the ${kind} "${item.title}" to ${channelName(channel)} (id ${result.id})`, {
      channel,
      kind,
      itemId,
      textSha256: confirm.textSha256,
      externalId: result.id,
      url: result.url ?? null,
    });
    return toItem(r.rows[0]);
  });
  return { ok: true, id: result.id, url: result.url, item: updated };
}

export const resolveBody = z
  .object({
    projectId: z.string().min(1).max(80),
    kind: z.enum(["post", "reply"]),
    itemId: z.number().int().positive(),
    /** what the user found on the channel */
    outcome: z.enum(["not-posted", "posted"]),
    /** posted: the service's id or address of the post, when the user has it */
    externalId: z.string().trim().max(120).optional(),
    url: z.string().trim().max(2000).optional(),
  })
  .strict();
export type ResolveBody = z.infer<typeof resolveBody>;

/**
 * The separate, recorded action that settles an unknown outcome (robustness review S9). "not-posted" clears the
 * marker, so the row may be sent again after a new confirmation; "posted" records it as sent (with the id or
 * address when given) and moves it to posted or sent. Either way the activity and the audit log name who checked.
 */
export async function resolveUnknown(b: ResolveBody): Promise<Item> {
  const actor = currentActor() || "unknown";
  return tx(async (c) => {
    const item = await rowOf(b.projectId, b.kind, b.itemId, c);
    if (item.data.sent) throw new HttpError(409, "This was already recorded as sent.");
    if (!outcomeUnknown(item.data)) throw new HttpError(409, "Nothing to settle: the last send's outcome is known.");
    const where = channelName(channelOf(item.data.channel) ?? "instagram");
    let r;
    if (b.outcome === "not-posted") {
      r = await c.query<ItemRow>(`UPDATE items SET data = (data - 'sending') - 'sendUnknown', updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [b.itemId]);
      await logEventIn(c, b.projectId, `channel.${b.kind}.resolved`, `${actor} checked ${where}: the ${b.kind} "${item.title}" was not posted`, { itemId: b.itemId, outcome: b.outcome });
    } else {
      const sent = { id: b.externalId ?? "", at: new Date().toISOString(), ...(b.url ? { url: b.url } : {}), by: actor, recordedByHand: true };
      r = await c.query<ItemRow>(
        `UPDATE items SET status=$2, data = ((data - 'sending') - 'sendUnknown') || $3::jsonb, updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`,
        [b.itemId, DONE_STATUS[b.kind], JSON.stringify({ sent })]
      );
      await logEventIn(c, b.projectId, `channel.${b.kind}.resolved`, `${actor} checked ${where}: the ${b.kind} "${item.title}" was posted`, { itemId: b.itemId, outcome: b.outcome, externalId: b.externalId ?? null, url: b.url ?? null });
    }
    return toItem(r.rows[0]);
  });
}
