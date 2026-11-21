// Evidence on a claim: one named source and whether it supports the claim.
// The claim's status is worked out from its evidence (src/lib/research/status.ts) and written in
// the same transaction as the evidence change, with an event holding the before and after.
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { body, HttpError, notFound, route } from "@/lib/api/route";
import { CLAIMS_SECTION, claimEvidence, evidenceAdd, evidenceRemove, readSources, type EvidenceEntry } from "@/lib/research/schemas";
import { claimStatus, isDisputed } from "@/lib/research/status";

async function lockClaim(c: PoolClient, claimId: number) {
  const res = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [claimId]);
  const row = res.rows[0];
  if (!row) throw notFound("That claim");
  if (row.section !== CLAIMS_SECTION) throw new HttpError(400, `That row is not a claim: it belongs to ${row.section}, not ${CLAIMS_SECTION}.`);
  const parsed = claimEvidence.safeParse(row.data?.evidence ?? []);
  if (!parsed.success) {
    throw new HttpError(409, "This claim's evidence list is not in the shape the app expects, so it was left untouched. Fix or clear data.evidence on the claim first.");
  }
  return { row, evidence: parsed.data };
}

async function save(c: PoolClient, row: ItemRow, before: EvidenceEntry[], after: EvidenceEntry[], change: { action: "added" | "removed"; entry: EvidenceEntry }) {
  const statusBefore = row.status;
  const statusAfter = claimStatus(after);
  const res = await c.query<ItemRow>(
    `UPDATE items SET data = data || jsonb_build_object('evidence', $2::jsonb), status = $3, updated_at = now()
     WHERE id=$1 RETURNING ${ITEM_COLS}`,
    [row.id, JSON.stringify(after), statusAfter]
  );
  const now = res.rows[0];
  const where = change.entry.title ? `${change.entry.title} (${change.entry.url})` : change.entry.url;
  const summary =
    change.action === "added"
      ? `Evidence on "${row.title}": ${where} ${change.entry.verdict === "unclear" ? "is unclear" : change.entry.verdict} the claim; status ${statusBefore} → ${statusAfter}`
      : `Evidence removed from "${row.title}": ${where}; status ${statusBefore} → ${statusAfter}`;
  await logEventIn(c, row.project_id, change.action === "added" ? "claim.evidence.added" : "claim.evidence.removed", summary, {
    itemId: now.id,
    url: change.entry.url,
    verdict: change.entry.verdict,
    before: { status: statusBefore, evidence: before },
    after: { status: statusAfter, evidence: after, disputed: isDisputed(after) },
  });
  return { item: toItem(now), status: statusAfter, disputed: isDisputed(after), evidence: after };
}

export const POST = route(async (req: Request) => {
  const b = await body(req, evidenceAdd);
  const out = await tx(async (c) => {
    const { row, evidence } = await lockClaim(c, b.claimId);
    // The source's title as Perplexity gave it, so the claim reads well later; a title sent with the request wins.
    let title = b.title;
    if (b.researchId !== undefined) {
      const r = await c.query<{ project_id: string; citations: unknown; sources: unknown }>("SELECT project_id, citations, sources FROM research WHERE id=$1", [b.researchId]);
      const entry = r.rows[0];
      if (!entry) throw notFound("That research entry");
      if (entry.project_id !== row.project_id) throw new HttpError(400, "That research entry belongs to another concept than the claim.");
      const cited = Array.isArray(entry.citations) ? entry.citations : [];
      if (!cited.includes(b.url)) throw new HttpError(400, "That address is not one of the sources of that research entry.");
      if (!title) title = readSources(entry.sources, entry.citations).find((x) => x.url === b.url)?.title || undefined;
    }
    if (evidence.some((e) => e.url === b.url)) {
      throw new HttpError(409, "This source is already evidence for this claim. Remove it first to change its verdict.");
    }
    const entry: EvidenceEntry = {
      url: b.url,
      ...(title ? { title } : {}),
      ...(b.quote ? { quote: b.quote } : {}),
      ...(b.researchId !== undefined ? { researchId: b.researchId } : {}),
      verdict: b.verdict,
      addedAt: new Date().toISOString(),
    };
    return save(c, row, evidence, [...evidence, entry], { action: "added", entry });
  });
  return NextResponse.json(out, { status: 201 });
});

export const DELETE = route(async (req: Request) => {
  const b = await body(req, evidenceRemove);
  const out = await tx(async (c) => {
    const { row, evidence } = await lockClaim(c, b.claimId);
    const gone = evidence.find((e) => e.url === b.url);
    if (!gone) throw notFound("That source on this claim");
    return save(c, row, evidence, evidence.filter((e) => e.url !== b.url), { action: "removed", entry: gone });
  });
  return NextResponse.json(out);
});
