// Server rules for content rows. Called from three places that can move a row past "draft":
// approving an AI draft (src/lib/ai/drafts/store.ts), PATCH /api/items/[id], and creating a row.
// Nothing here trusts a stored flag: the check runs again on the words as they are now.
import { HttpError } from "@/lib/api/route";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { adChannel, checkChannel, checkListing, checkSocial, listingCategory, refusals, socialChannel, type FieldValues } from "./channels";
import { evaluate, flagSummary, type Flag, type ProofRow } from "./claims";
import { CONTENT, CONTENT_STORES, claimFields } from "./schemas";

/** Statuses that need no check: the row is not being released to anything. */
const FREE = new Set(["draft", "planned", "killed", "paused", "rejected"]);

export async function linkedRows(projectId: string, data: Record<string, unknown>): Promise<ProofRow[]> {
  const ids = (Array.isArray(data.proof) ? data.proof : []).map((p) => Number((p as { itemId?: unknown })?.itemId)).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return [];
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND id = ANY($2)`, [projectId, ids])).map(toItem);
  return rows.map((r) => ({ id: r.id, section: r.section, title: r.title, body: r.body, status: r.status, data: r.data }));
}

/** The flags for one row as it reads now. */
export async function flagsFor(projectId: string, section: string, title: string, body: string, data: Record<string, unknown>): Promise<Flag[]> {
  const fields = claimFields(section, title, body, data);
  if (!fields.length) return [];
  const links = await linkedRows(projectId, data);
  const names = (await q<{ name: string }>("SELECT name FROM projects WHERE id=$1", [projectId])).map((r) => r.name);
  return evaluate(fields, links, names);
}

/** The data with its flags brought up to date (used when a draft is edited). */
export async function withFlags(projectId: string, section: string, title: string, body: string, data: Record<string, unknown>) {
  if (!CONTENT_STORES.has(section)) return data;
  const flags = await flagsFor(projectId, section, title, body, data);
  return { ...data, flags, noProof: flags.length > 0 };
}

function adValues(data: Record<string, unknown>): FieldValues {
  return (data.fields ?? {}) as FieldValues;
}

/**
 * Throws when a row cannot be at this status. `status` is the status the row would have.
 * A 409 is something the writer can fix by editing; a 400 is a shape the app refuses.
 */
export async function assertContentAllowed(projectId: string, section: string, status: string, title: string, body: string, data: Record<string, unknown>) {
  if (!CONTENT_STORES.has(section) || FREE.has(status)) return;
  const flags = await flagsFor(projectId, section, title, body, data);
  if (flags.length) {
    throw new HttpError(409, `No proof: this cannot be ${status} yet. ${flagSummary(flags)}${flags.length > 3 ? ` (${flags.length} lines in all)` : ""} Link a verified claim or a passing test that backs it, or take the line out.`, { flags });
  }
  if (section === CONTENT.ads) {
    const spec = adChannel(String(data.channel ?? ""));
    if (!spec) throw new HttpError(400, "Choose an ad channel first.");
    const bad = refusals(checkChannel(spec, adValues(data), { forApproval: true }));
    if (bad.length) throw new HttpError(400, `Over a platform limit or incomplete: ${bad.map((b) => b.message).join(" ")}`, { problems: bad });
    const ceiling = data.costPerOrderCeilingMinor;
    const minSpend = data.minSpendBeforeJudgingMinor;
    if (!String(data.stopRule ?? "").trim() || typeof ceiling !== "number" || typeof minSpend !== "number") {
      throw new HttpError(409, "Write the stop and scale rule first: the sentence, the highest cost per order you will accept and the least you will spend before judging the ad.");
    }
  }
  if (section === CONTENT.social) {
    const spec = socialChannel(String(data.channel ?? ""));
    if (!spec) throw new HttpError(400, "Choose a channel first.");
    const bad = refusals(checkSocial(spec, body, String(data.postTitle ?? "")));
    if (bad.length) throw new HttpError(400, `Over a platform limit: ${bad.map((b) => b.message).join(" ")}`, { problems: bad });
    if (status === "scheduled" && !data.scheduledAt) throw new HttpError(409, "Give the post a date before it is scheduled.");
  }
  if (section === CONTENT.listing) {
    const f = (data.fields ?? {}) as { title?: string; bullets?: string[]; description?: string; searchTerms?: string };
    const bad = refusals(checkListing(listingCategory(String(data.category ?? "default")), { title: f.title ?? "", bullets: f.bullets ?? [], description: f.description ?? "", searchTerms: f.searchTerms ?? "" }, { forApproval: true }));
    if (bad.length) throw new HttpError(400, `Over an Amazon limit or incomplete: ${bad.map((b) => b.message).join(" ")}`, { problems: bad });
  }
}

/** A new row cannot start past draft. */
export async function assertNewContent(projectId: string, row: { section: string; title: string; body?: string; data?: Record<string, unknown>; status?: string }) {
  if (!CONTENT_STORES.has(row.section) || !row.status) return;
  await assertContentAllowed(projectId, row.section, row.status, row.title, row.body ?? "", row.data ?? {});
}

/** Accepting an AI draft into the section: no flagged line and no hard limit broken. The stop rule and the dates come later. */
export async function assertDraftAllowed(projectId: string, section: string, title: string, body: string, data: Record<string, unknown>) {
  if (!CONTENT_STORES.has(section)) return;
  const flags = await flagsFor(projectId, section, title, body, data);
  if (flags.length) {
    throw new HttpError(409, `No proof: this draft cannot be approved yet. ${flagSummary(flags)}${flags.length > 3 ? ` (${flags.length} lines in all)` : ""} Edit the draft to link a verified claim or a passing test, or take the line out.`, { flags });
  }
  if (section === CONTENT.ads) {
    const spec = adChannel(String(data.channel ?? ""));
    const bad = spec ? refusals(checkChannel(spec, adValues(data))) : [];
    if (bad.length) throw new HttpError(400, `Over a platform limit: ${bad.map((b) => b.message).join(" ")}`, { problems: bad });
  }
  if (section === CONTENT.social) {
    const spec = socialChannel(String(data.channel ?? ""));
    const bad = spec ? refusals(checkSocial(spec, body, String(data.postTitle ?? ""))) : [];
    if (bad.length) throw new HttpError(400, `Over a platform limit: ${bad.map((b) => b.message).join(" ")}`, { problems: bad });
  }
  if (section === CONTENT.listing) {
    const f = (data.fields ?? {}) as { title?: string; bullets?: string[]; description?: string; searchTerms?: string };
    const bad = refusals(checkListing(listingCategory(String(data.category ?? "default")), { title: f.title ?? "", bullets: f.bullets ?? [], description: f.description ?? "", searchTerms: f.searchTerms ?? "" }));
    if (bad.length) throw new HttpError(400, `Over an Amazon limit: ${bad.map((b) => b.message).join(" ")}`, { problems: bad });
  }
}
