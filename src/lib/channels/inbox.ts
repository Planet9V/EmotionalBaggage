// Reading mentions (X) and comments (Instagram) into Marketing, Replies and comments (plan 8.18, 8.19).
// Read only. One row per mention or comment (externalId, kept unique by migration 0021). Only what a
// reply needs is kept: the text, the author's public handle, the time, the link and the id to reply to.
import { channelName } from "./registry";
import { HttpError } from "@/lib/api/route";
import { currentActor } from "@/lib/actor";
import { audit, logEventIn, q, tx } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { igRecentComments } from "./instagram";
import { CHANNEL } from "./schemas";
import { xAccount, xCostAck, X_COST_ACK } from "./state";
import { X_COST_STATEMENT } from "./xCost";
import { xMe, xMentions } from "./x";

type InboundRow = { channel: string; externalId: string; replyTo: string; author: string; at: string; url: string; parent: string; text: string };

/** Writes inbound rows; a row already read is left as it is. Answers how many were new. */
async function upsertInbound(projectId: string, rows: InboundRow[]) {
  let added = 0;
  await tx(async (c) => {
    for (const r of rows) {
      const title = `${r.channel}${r.author ? ` @${r.author}` : ""}: ${r.text.replace(/\s+/g, " ").slice(0, 80)}`;
      const data = { channel: r.channel, externalId: r.externalId, replyTo: r.replyTo, author: r.author, at: r.at, url: r.url, parent: r.parent };
      const res = await c.query(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1, $2, $3, $4, $5, 'new', (SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
         ON CONFLICT (project_id, section, (data->>'externalId')) WHERE data ? 'externalId' DO NOTHING RETURNING id`,
        [projectId, CHANNEL.inbox, title.slice(0, 300), r.text.slice(0, 20_000), JSON.stringify(data)]
      );
      added += res.rowCount ?? 0;
    }
  });
  return added;
}

/** Records that the user read the current X cost statement. Required before any X call that costs money. */
export async function acknowledgeXCost() {
  const by = currentActor() || "unknown";
  const ack = { version: X_COST_STATEMENT.version, by, at: new Date().toISOString() };
  await setSetting(X_COST_ACK, ack);
  await audit({ action: "channel.x.cost-acknowledged", summary: `${by} read X's cost statement (${X_COST_STATEMENT.read}) and ticked that they had read it`, detail: { version: ack.version, url: X_COST_STATEMENT.url } });
  return ack;
}

export async function fetchInbox(projectId: string, channel: "x" | "instagram"): Promise<{ added: number; read: number; message: string }> {
  let rows: InboundRow[] = [];
  if (channel === "x") {
    const ack = await xCostAck();
    if (ack?.version !== X_COST_STATEMENT.version) throw new HttpError(409, "Reading mentions is billed by X. Read X's cost statement and tick that you have read it first.", { needsCostAck: true });
    const acct = await xAccount();
    const me = acct?.userId ? { id: acct.userId } : await xMe();
    const newest = await q<{ id: string | null }>(
      `SELECT max((data->>'replyTo')::numeric)::text AS id FROM items WHERE project_id=$1 AND section=$2 AND data->>'channel'='X' AND data->>'replyTo' ~ '^[0-9]+$'`,
      [projectId, CHANNEL.inbox]
    );
    const mentions = await xMentions(me.id, newest[0]?.id ?? undefined);
    rows = mentions.map((m) => ({ channel: channelName("x"), externalId: `x:${m.id}`, replyTo: m.id, author: m.author, at: m.at, url: m.url, parent: m.conversationId, text: m.text }));
  } else {
    const comments = await igRecentComments();
    rows = comments.map((cm) => ({ channel: channelName("instagram"), externalId: `ig:${cm.id}`, replyTo: cm.id, author: cm.author, at: cm.at, url: cm.url, parent: cm.mediaId, text: cm.text }));
  }
  const added = await upsertInbound(projectId, rows);
  const where = channel === "x" ? "X mentions" : "Instagram comments";
  const message = `Read ${rows.length} ${rows.length === 1 ? where.replace(/s$/, "") : where}; ${added} new.`;
  await tx((c) => logEventIn(c, projectId, `channel.${channel}.inbox`, message, { read: rows.length, added }));
  return { added, read: rows.length, message };
}
