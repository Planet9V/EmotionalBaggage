import { NextResponse } from "next/server";
import { changedDetail, itemDiff } from "@/lib/trace/changes";
import { z } from "zod";
import { complete, getReasoning } from "@/lib/ai/models";
import { REVIEWER_SYSTEM, reviewerContext } from "@/lib/ai/reviewer";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { body, HttpError, notFound, requireProject, route } from "@/lib/api/route";
import { POSITIONING_FOCUS, positioningFingerprint } from "@/lib/market/critique";
import { positioningLine } from "@/lib/market/positioning";
import { checkProof } from "@/lib/market/proof";
import { loadProofRows } from "@/lib/market/proofRows";
import { MARKET, positioningData } from "@/lib/market/schemas";

type Ctx = { params: Promise<{ id: string }> };

const input = z.object({ itemId: z.number().int().positive() });

/**
 * Asks the shared reviewer to attack a positioning, and stores the critique on the row
 * (data.critique) so it shows beside the positioning. Approval needs it (src/lib/market/rules.ts).
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await requireProject(id);
  const { itemId } = await body(req, input);
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3`, [itemId, id, MARKET.positioning]);
  if (!rows.length) throw notFound("That positioning");
  const item = toItem(rows[0]);
  const data = positioningData.parse(item.data);
  if (!data.forWhom && !(data.messages ?? []).length) throw new HttpError(409, "The positioning is empty. Fill in the line and the messages first.");

  const reasoning = await getReasoning();
  if (!reasoning.ok) throw new HttpError(503, reasoning.reason);

  const byId = await loadProofRows(null, id, data);
  const checked = checkProof(data.messages ?? [], byId);
  const shown = [
    `Positioning line: ${positioningLine(data, project.name)}`,
    ...checked.map(
      (m, i) =>
        `Message ${i + 1}: ${m.message.text}\n  Proof: ${m.links.length ? m.links.map((l) => `${l.ref.title ?? `item ${l.ref.itemId}`} (${l.state})`).join("; ") : "none linked"}${m.hasProof ? "" : " [NO PROOF]"}`
    ),
  ].join("\n");

  const context = await reviewerContext(project);
  const { text, info } = await complete({
    use: reasoning,
    system: `${REVIEWER_SYSTEM}\n\n${POSITIONING_FOCUS}\n\nWhat is on record for this concept:\n${context}`,
    messages: [{ role: "user", content: shown }],
    maxOutputTokens: 900,
    signal: req.signal,
  });

  const saved = await tx(async (c) => {
    const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [itemId])).rows[0];
    const upd = await c.query<ItemRow>(
      `UPDATE items SET data = data || jsonb_build_object('critique', $2::jsonb), updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`,
      [itemId, JSON.stringify({ text, at: new Date().toISOString(), model: info.model, fingerprint: positioningFingerprint(item.data) })]
    );
    await logEventIn(c, id, "market.critique", "The reviewer attacked the positioning", { ...changedDetail(upd.rows[0], itemDiff(was, upd.rows[0])), model: info.model });
    return upd.rows[0];
  });
  return NextResponse.json({ item: toItem(saved) });
});
