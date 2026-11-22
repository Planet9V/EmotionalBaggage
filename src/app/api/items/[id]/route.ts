import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { body, notFound, recordId, route } from "@/lib/api/route";
import { assertStatus, dataSizeProblem, itemPatch, parseData } from "@/lib/api/schemas";
import { z } from "zod";
import { assertClaimChange } from "@/lib/research/rules";
import { changedDetail, itemDiff, removedDetail } from "@/lib/trace/changes";
import { assertBuildMayPass, assertLinks, demoteBrokenBuilds, relinkKey, REVERTED } from "@/lib/trace/links";
import { lostByEdit, PASSED } from "@/lib/trace/builds";
import { STORE } from "@/lib/domain/schemas";
import { keyOf } from "@/lib/trace/spec";
import { reasonDetail } from "@/lib/trace/why";
import { mirrorLinks } from "@/lib/trace/mirror";
import { assertMarketChange } from "@/lib/market/rules";
import { loadProofRows } from "@/lib/market/proofRows";
import { MARKET } from "@/lib/market/schemas";
import { assertAttackUntouched } from "@/lib/ai/drafts/attack";
import { assertPrintChange } from "@/lib/slicing/rules";
import { assertSendChange, handMarkedSent } from "@/lib/channels/rules";
import { currentActor } from "@/lib/actor";
import { assertContentAllowed, withFlags } from "@/lib/content/rules";
import { CONTENT_STORES } from "@/lib/content/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** data is merged key by key, so a view can patch one field without resending the rest. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  const { why, ...b } = await body(req, itemPatch);
  const now = await tx(async (c) => {
    const before = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [id]);
    const was = before.rows[0];
    if (!was) throw notFound("That row");
    assertStatus(was.section, b.status);
    // Claims: evidence only through /api/research/evidence; a hand-set status the evidence allows.
    assertClaimChange(was, b);
    // Positioning: approval needs the reviewer's critique, which only its own route writes, and proof for every message.
    assertMarketChange(was, b, was.section === MARKET.positioning ? await loadProofRows(c, was.project_id, { ...was.data, ...(b.data ?? {}) }) : new Map());
    assertAttackUntouched(was.section, b.data);
    // Print jobs: slicing, sending and starting only through their own routes.
    assertPrintChange(was, b);
    // Posts and replies: the send markers are written only by sending (robustness review S9).
    assertSendChange(was, b);
    let data = parseData(was.section, b.data);
    // moved to posted or sent by hand: kept, and recorded as marked by hand, never as an app send
    const byHand = handMarkedSent(was, b, currentActor());
    if (byHand) data = { ...(data ?? {}), ...byHand };
    // Content rows: the no-proof flags are worked out again on the words as they will be, and a row past
    // draft may not carry a flagged line or break a platform limit.
    if (CONTENT_STORES.has(was.section)) {
      const merged = { ...was.data, ...(data ?? {}) };
      data = await withFlags(was.project_id, was.section, b.title ?? was.title, b.body ?? was.body, merged);
      await assertContentAllowed(was.project_id, was.section, b.status ?? was.status, b.title ?? was.title, b.body ?? was.body, data, Number(was.id));
    }
    // the row as it will be: a patch may only add keys, so the merged data is what must fit (robustness review S8)
    if (data) {
      const size = dataSizeProblem(was.section, { ...was.data, ...data });
      if (size) throw new z.ZodError([{ code: "custom", path: ["data"], message: size, input: undefined }]);
    }
    await assertLinks(c, was.project_id, was.section, data);
    await assertBuildMayPass(c, was.project_id, { section: was.section, title: b.title ?? was.title, status: b.status ?? was.status, data: { ...was.data, ...(data ?? {}) } });
    // A passed build that gives up a linked test or an exit criterion goes back to testing, with the reason kept (process review 2).
    let status = b.status;
    let autoReason = "";
    if (was.section === STORE.builds && was.status === PASSED && (b.status ?? was.status) === PASSED && data) {
      const lost = lostByEdit(was.data, { ...was.data, ...data });
      if (lost.length) {
        status = REVERTED;
        autoReason = lost.join("; ");
        data = { ...data, revertedBecause: autoReason };
      }
    }
    // Passed again: the old reason for sending it back is cleared.
    if (was.section === STORE.builds && status === PASSED && was.status !== PASSED && typeof was.data.revertedBecause === "string" && was.data.revertedBecause) {
      data = { ...(data ?? {}), revertedBecause: "" };
    }
    const res = await c.query<ItemRow>(
      `UPDATE items SET
         title = COALESCE($2, title),
         body = COALESCE($3, body),
         data = data || COALESCE($4::jsonb, '{}'::jsonb),
         status = COALESCE($5, status),
         sort = COALESCE($6, sort),
         updated_at = now()
       WHERE id=$1 RETURNING ${ITEM_COLS}`,
      [id, b.title ?? null, b.body ?? null, data ? JSON.stringify(data) : null, status ?? null, b.sort ?? null]
    );
    const row = res.rows[0];
    const diff = itemDiff(was, row);
    // A key that changed or went away takes the links that named it with it, in this transaction.
    const oldKey = keyOf(was.data);
    const newKey = keyOf(row.data);
    if (oldKey && oldKey !== newKey) {
      // A test that lost its key can no longer be found by the builds that name it: they go back first.
      if (!newKey && was.section === STORE.tests) await demoteBrokenBuilds(c, row.project_id, { [oldKey]: was.title });
      await relinkKey(c, row, oldKey, newKey || null, newKey ? `the key ${oldKey} became ${newKey}` : `the key ${oldKey} was removed`);
    }
    // A link added or removed at this end is added or removed at the other end too.
    await mirrorLinks(c, was, row);
    // A write that changes nothing leaves no line: the record holds changes, not clicks.
    if (Object.keys(diff.after).length || Object.keys(diff.before).length) {
      const detail = { ...changedDetail(row, diff), ...reasonDetail(why) };
      if (row.status !== was.status) {
        await logEventIn(c, row.project_id, "item.status", `"${row.title}" moved from ${was.status} to ${row.status}${autoReason ? `: ${autoReason}` : ""}`, autoReason ? { ...detail, reason: autoReason, auto: true } : detail);
      } else {
        await logEventIn(c, row.project_id, "item.edited", `Edited "${row.title}" in ${row.section}`, detail);
      }
    }
    // The gate reads live evidence: a test that no longer passes takes the passed builds that name it back to testing.
    if (was.section === STORE.tests && row.status !== was.status) await demoteBrokenBuilds(c, row.project_id);
    return row;
  });
  return NextResponse.json({ item: toItem(now) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  await tx(async (c) => {
    const res = await c.query<ItemRow>(`DELETE FROM items WHERE id=$1 RETURNING ${ITEM_COLS}`, [id]);
    const row = res.rows[0];
    if (!row) throw notFound("That row");
    // Rows that linked to this one lose the link in the same transaction, each recorded.
    // A deleted test takes the passed builds that named it back to testing, before their lists lose its key.
    if (row.section === STORE.tests && keyOf(row.data)) await demoteBrokenBuilds(c, row.project_id, { [keyOf(row.data)]: row.title });
    const unlinked = await relinkKey(c, row, keyOf(row.data), null, `the linked row "${row.title}" was deleted`);
    await logEventIn(c, row.project_id, "item.removed", `Removed "${row.title}" from ${row.section}`, removedDetail(row, unlinked.length ? { unlinked: unlinked.map((u) => ({ itemId: u.id, title: u.title, field: u.field })) } : {}));
  });
  return NextResponse.json({ ok: true });
});
