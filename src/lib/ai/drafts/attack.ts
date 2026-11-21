// The reviewer attacks an approved press release or FAQ entry once (plan 4.2), on the server, right after
// approval. It used to run in the browser and was lost if the user left the page. The attack is claimed
// on the row first (data.attack = running, in one UPDATE that only succeeds when the row has none), so two
// approvals, two tabs or a retry can never attack the same row twice. The result is recorded on the row
// (data.attack) and as the reviewer's message linked to the row, with the change in the activity list.
import { after } from "next/server";
import { currentActor } from "@/lib/actor";
import { HttpError } from "@/lib/api/route";
import { complete, getReasoning } from "@/lib/ai/models";
import { reviewerSystem } from "@/lib/ai/reviewer";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { ATTACK_MESSAGE, type AttackRecord } from "./shared";

/** Stores whose approved rows the reviewer attacks. */
const ATTACK_STORES = new Set(Object.keys(ATTACK_MESSAGE));

/** The attack record on a row, read defensively. */
function attackOf(data: Record<string, unknown> | undefined): AttackRecord | null {
  const a = data?.attack as AttackRecord | undefined;
  return a && typeof a === "object" && (a.state === "running" || a.state === "done" || a.state === "failed") ? a : null;
}

/** A row's data.attack is the server's: no ordinary save may write it. */
export function assertAttackUntouched(section: string, data: Record<string, unknown> | undefined) {
  if (ATTACK_STORES.has(section) && data && Object.prototype.hasOwnProperty.call(data, "attack")) {
    throw new HttpError(400, "The reviewer's attack is recorded by the server and cannot be set or edited.");
  }
}

/** A "running" claim older than this is treated as lost (the server stopped mid-call) and may be taken again. */
const STALE_MS = 10 * 60 * 1000;

export type AttackOutcome = { ran: boolean; reason: string; record: AttackRecord | null };

/**
 * Attacks the row once. Returns without calling the model when the row is not an attacked kind, was
 * attacked already, is being attacked, or no reasoning model is chosen (then the row says so and the
 * Attack it button can try again).
 */
export async function attackOnce(projectId: string, itemId: number, by = currentActor() ?? ""): Promise<AttackOutcome> {
  const now = new Date().toISOString();
  const claim: AttackRecord = { state: "running", at: now, by };
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const claimed = await q<ItemRow>(
    `UPDATE items SET data = data || jsonb_build_object('attack', $3::jsonb)
      WHERE id=$1 AND project_id=$2 AND section = ANY($4)
        AND (NOT (data ? 'attack') OR data->'attack'->>'state' = 'failed'
             OR (data->'attack'->>'state' = 'running' AND data->'attack'->>'at' < $5))
      RETURNING ${ITEM_COLS}`,
    [itemId, projectId, JSON.stringify(claim), [...ATTACK_STORES], staleBefore]
  );
  if (!claimed.length) {
    const r = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2`, [itemId, projectId]);
    const was = r[0] ? attackOf(toItem(r[0]).data) : null;
    return { ran: false, reason: !r[0] ? "no such row" : was?.state === "done" ? "already attacked" : was?.state === "running" ? "being attacked" : "not a press release or FAQ entry", record: was };
  }
  const item = toItem(claimed[0]);
  const finish = async (record: AttackRecord, messages?: { ask: string; reply: string }) =>
    tx(async (c) => {
      let messageId = 0;
      if (messages) {
        const m = await c.query<{ id: string }>(
          "INSERT INTO messages (project_id, role, content, item_id) VALUES ($1,'user',$2,$4), ($1,'assistant',$3,$4) RETURNING id",
          [projectId, messages.ask, messages.reply, itemId]
        );
        messageId = Number(m.rows[m.rows.length - 1].id);
      }
      const final = record.state === "done" ? { ...record, messageId } : record;
      await c.query("UPDATE items SET data = data || jsonb_build_object('attack', $2::jsonb), updated_at = now() WHERE id=$1", [itemId, JSON.stringify(final)]);
      await logEventIn(
        c,
        projectId,
        record.state === "done" ? "challenge.row" : "challenge.failed",
        record.state === "done" ? `The AI reviewer attacked "${item.title}" once, after its approval` : `The AI reviewer could not attack "${item.title}": ${(record as { reason: string }).reason}`,
        { itemId, section: item.section, title: item.title, before: { "data.attack": null }, after: { "data.attack": final } }
      );
      return final;
    });

  const reasoning = await getReasoning();
  if (!reasoning.ok) return { ran: false, reason: reasoning.reason, record: await finish({ state: "failed", at: new Date().toISOString(), by, reason: reasoning.reason }) };
  const ask = ATTACK_MESSAGE[item.section];
  try {
    const p = await q<{ id: string; name: string; one_liner: string }>("SELECT id, name, one_liner FROM projects WHERE id=$1", [projectId]);
    const { text, info } = await complete({ use: reasoning, system: await reviewerSystem(p[0], item), messages: [{ role: "user", content: ask }], maxOutputTokens: 1200 });
    return { ran: true, reason: "", record: await finish({ state: "done", at: new Date().toISOString(), by, model: info.model, messageId: 0 }, { ask, reply: text }) };
  } catch (e) {
    const reason = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    return { ran: false, reason, record: await finish({ state: "failed", at: new Date().toISOString(), by, reason }) };
  }
}

/**
 * After approval, attack each approved press release or FAQ entry once. Scheduled with Next.js `after`, so
 * it runs on the server after the response whatever the browser does; outside a request (a test, a
 * script) it starts at once. Returns the started work when it started at once, for whoever wants to wait.
 */
export function scheduleAttacks(projectId: string, items: { id: number; section: string }[]): Promise<unknown> | null {
  const targets = items.filter((i) => ATTACK_STORES.has(i.section));
  if (!targets.length) return null;
  const by = currentActor() ?? "";
  const work = async () => {
    for (const t of targets) await attackOnce(projectId, t.id, by).catch(() => undefined);
  };
  try {
    after(work);
    return null;
  } catch {
    return work();
  }
}
