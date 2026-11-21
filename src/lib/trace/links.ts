// Links between rows, kept by key (src/lib/trace/spec.ts), checked and kept whole on the server.
import { z } from "zod";
import type { PoolClient } from "pg";
import { ITEM_COLS, logEventIn, type ItemRow } from "@/lib/db";
import { HttpError } from "@/lib/api/route";
import { changedDetail, itemDiff } from "./changes";
import { lostEvidence, PASSED, passRefusal } from "./builds";
import { LINK_FIELDS, listOf } from "./spec";
import { STORE } from "@/lib/domain/schemas";

/** Refuses a key list that names a row that does not exist, or one in the wrong section. `data` is what the request sets. */
export async function assertLinks(c: PoolClient, projectId: string, section: string, data: Record<string, unknown> | undefined) {
  const fields = LINK_FIELDS[section];
  if (!fields || !data) return;
  const issues: z.core.$ZodIssue[] = [];
  for (const [field, spec] of Object.entries(fields)) {
    if (!(field in data)) continue;
    const wanted = listOf(data, field);
    if (!wanted.length) continue;
    const found = await c.query<{ key: string; section: string }>("SELECT data->>'key' AS key, section FROM items WHERE project_id=$1 AND data->>'key' = ANY($2::text[])", [projectId, wanted]);
    const where = new Map(found.rows.map((r) => [r.key, r.section]));
    for (const key of wanted) {
      const at = where.get(key);
      if (at === spec.section) continue;
      issues.push({
        code: "custom",
        path: ["data", field],
        input: key,
        message: at
          ? `"${key}" is not ${/^[aeiou]/.test(spec.noun) ? "an" : "a"} ${spec.noun} in this concept: it names a row in ${at}. Pick from ${spec.where}.`
          : `"${key}" names no ${spec.noun} in this concept. Pick from ${spec.where}; a row needs a key before it can be linked.`,
      });
    }
  }
  if (issues.length) throw new z.ZodError(issues);
}

/**
 * A row's key was removed or changed: every list that held it is rewritten in the same transaction, each
 * as a recorded edit of the row that held it. `to` null removes the key; a string renames it.
 */
export async function relinkKey(c: PoolClient, row: Pick<ItemRow, "project_id" | "section">, key: string, to: string | null, why: string) {
  if (!key) return [];
  const touched: { id: number; title: string; section: string; field: string }[] = [];
  for (const [holder, fields] of Object.entries(LINK_FIELDS)) {
    for (const [field, spec] of Object.entries(fields)) {
      if (spec.section !== row.section) continue;
      const res = await c.query<ItemRow>(
        `SELECT id, project_id, section, title, body, data, status, sort FROM items
         WHERE project_id=$1 AND section=$2 AND jsonb_exists(data->$3, $4) FOR UPDATE`,
        [row.project_id, holder, field, key]
      );
      for (const was of res.rows) {
        const old = listOf(was.data, field);
        const next = [...new Set(old.flatMap((k) => (k === key ? (to === null ? [] : [to]) : [k])))];
        const upd = await c.query<ItemRow>(
          `UPDATE items SET data = data || jsonb_build_object($2::text, $3::jsonb), updated_at = now() WHERE id=$1
           RETURNING id, project_id, section, title, body, data, status, sort`,
          [was.id, field, JSON.stringify(next)]
        );
        const now = upd.rows[0];
        await logEventIn(c, now.project_id, "item.edited", `"${now.title}": ${why}`, changedDetail(now, { before: { [`data.${field}`]: old }, after: { [`data.${field}`]: next } }));
        touched.push({ id: Number(now.id), title: now.title, section: now.section, field });
      }
    }
  }
  return touched;
}

/** Refuses a write that would leave a build marked passed while a criterion is unmet or a linked test has not passed. */
export async function assertBuildMayPass(c: PoolClient, projectId: string, row: { section: string; title: string; status: string; data: Record<string, unknown> }) {
  if (row.section !== STORE.builds || row.status !== PASSED) return;
  const keys = listOf(row.data, "tests");
  const tests = keys.length
    ? (await c.query<{ title: string; status: string; data: Record<string, unknown> }>("SELECT title, status, data FROM items WHERE project_id=$1 AND section=$2 AND data->>'key' = ANY($3::text[])", [projectId, STORE.tests, keys])).rows
    : [];
  const why = passRefusal(row, tests);
  if (why) throw new HttpError(400, why);
}

/** The one place a passed build goes back: status testing, the reason kept on the row and in the history. */
export const REVERTED = "testing";

async function sendBack(c: PoolClient, was: ItemRow, reasons: string[]) {
  const reason = reasons.join("; ");
  const res = await c.query<ItemRow>(
    `UPDATE items SET status=$2, data = data || jsonb_build_object('revertedBecause', $3::text), updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`,
    [was.id, REVERTED, reason]
  );
  const now = res.rows[0];
  await logEventIn(c, now.project_id, "item.status", `"${now.title}" moved from ${PASSED} to ${REVERTED}: ${reason}`, {
    ...changedDetail(now, itemDiff(was, now)),
    reason,
    auto: true,
  });
}

/**
 * The gate reads live evidence: after a test or a link changed, every passed build whose tests no longer
 * all pass, or that lost a linked test, goes back to "testing" in the same transaction, with the reason in the
 * history ("Drop no longer passes"). `gone` names tests deleted in this change, by key, for the sentence.
 */
export async function demoteBrokenBuilds(c: PoolClient, projectId: string, gone: Record<string, string> = {}) {
  const builds = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND status=$3 FOR UPDATE`, [projectId, STORE.builds, PASSED]);
  if (!builds.rows.length) return [];
  const tests = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2`, [projectId, STORE.tests]);
  const out: number[] = [];
  for (const b of builds.rows) {
    const reasons = lostEvidence(b, tests.rows, gone);
    if (!reasons.length) continue;
    await sendBack(c, b, reasons);
    out.push(Number(b.id));
  }
  return out;
}
