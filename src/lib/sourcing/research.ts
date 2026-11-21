// "Find alternates" and "Check prices": ask the research client (Perplexity; billed) and keep what comes back as drafts.
// A draft is saved only when the page it names is among the sources the answer cited. A price with no such page is dropped and
// reported, never stored as a fact. The answer itself is saved as a research row the way the Research screen saves one.
// The drafts go to the shared drafting engine (src/lib/ai/drafts): each is an "append" draft on the
// part, reviewed with its source page, and approving it is the only way it is added to the part.
import { ITEM_COLS, logEventIn, q, tx, type ItemRow } from "@/lib/db";
import { saveDrafts } from "@/lib/ai/drafts/run";
import type { Draft as EngineDraft } from "@/lib/ai/drafts/shared";
import { HttpError, notFound } from "@/lib/api/route";
import { getSecretFor, perplexityBaseUrl } from "@/lib/secretOrigin";
import { ask, type Source } from "@/lib/research/perplexity";
import { toStoredSource } from "@/lib/research/schemas";
import { newId, offerSchema, alternateSchema, type Draft } from "./schemas";
import { currencyOf } from "@/lib/economics/currency";
import { todayUtc } from "@/lib/format";

export type Kind = "prices" | "alternates";

type Part = { title: string; body: string; ref: string; partNumber: string; search: string };

export function questionFor(kind: Kind, p: Part, currency: string): string {
  const what = [p.title, p.partNumber && `part number ${p.partNumber}`, p.body && `(${p.body})`].filter(Boolean).join(" ");
  if (kind === "prices")
    return `Current prices to buy one pack of: ${what}, for a hobby prototype. Reply with up to 5 lines, one line per supplier, each line exactly in this form with the vertical bar between fields and nothing else on the line:\nSUPPLIER | PRICE OF ONE PACK AS A NUMBER | CURRENCY CODE | PIECES IN THE PACK | STOCK NOTE | PRODUCT PAGE URL\nGive prices in ${currency} when the page shows ${currency}; otherwise give the currency the page shows. Only write a line for a supplier whose page you read the price on. Write no line when you are not sure.`;
  return `Suggest up to 4 different parts that could replace: ${what}, in a hobby electronics prototype. Reply with one line per part, each line exactly in this form with the vertical bar between fields and nothing else on the line:\nNAME | PART NUMBER | WHAT WOULD HAVE TO CHANGE (pins, voltage, size, code) | PRODUCT OR DATASHEET PAGE URL\nOnly suggest a part you found a page for. Write no line when you are not sure.`;
}

const norm = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return "";
  }
};

/** True when the page a line names is one of the cited sources (same host and path; query and trailing slash ignored). */
export const isCited = (url: string, sources: Source[]) => {
  const n = norm(url);
  return !!n && sources.some((s) => norm(s.url) === n);
};

const clean = (s: string) => s.replace(/\[\d+\]/g, "").replace(/\*\*/g, "").trim();

export type Parsed = { drafts: Omit<Draft, "id" | "createdAt" | "researchId" | "model">[]; dropped: string[] };

export function parseAnswer(kind: Kind, answer: string, sources: Source[], currency: string, today: string): Parsed {
  const drafts: Parsed["drafts"] = [];
  const dropped: string[] = [];
  for (const raw of answer.split(/\r?\n/)) {
    if (!raw.includes("|")) continue;
    const f = raw.split("|").map(clean);
    if (/^(supplier|name)$/i.test(f[0]) || /^[-: ]+$/.test(f.join(""))) continue;
    if (kind === "prices") {
      if (f.length < 6) { dropped.push(`${f[0] || "a line"}: not in the form asked for`); continue; }
      const [supplier, price, cur, pack, stock, url] = f;
      const n = Number(price.replace(/[^0-9.]/g, ""));
      if (!isCited(url, sources)) { dropped.push(`${supplier}: no cited page for this price, so it was not saved`); continue; }
      if (cur.toUpperCase() !== currency) { dropped.push(`${supplier}: priced in ${cur || "an unnamed currency"}, and this concept is in ${currency}; no conversion is done`); continue; }
      const parsed = offerSchema.safeParse({ id: newId("o"), supplier, url, price: n, packSize: Number(pack.replace(/[^0-9]/g, "")) || 1, stock, checkedAt: today, source: "research", citation: url });
      if (!parsed.success || !Number.isFinite(n) || n <= 0) { dropped.push(`${supplier}: the price could not be read`); continue; }
      drafts.push({ kind: "offer", citation: url, offer: parsed.data });
    } else {
      if (f.length < 4) { dropped.push(`${f[0] || "a line"}: not in the form asked for`); continue; }
      const [name, partNumber, whatChanges, url] = f;
      if (!isCited(url, sources)) { dropped.push(`${name}: no cited page, so it was not saved`); continue; }
      const parsed = alternateSchema.safeParse({ id: newId("a"), name, partNumber, whatChanges, url, source: "research", citation: url });
      if (!parsed.success) { dropped.push(`${name}: could not be read`); continue; }
      drafts.push({ kind: "alternate", citation: url, alternate: parsed.data });
    }
  }
  return { drafts, dropped };
}

export type ResearchOutcome = { researchId: number; drafts: EngineDraft[]; dropped: string[]; costUsd: number | null; sources: number };

/** The engine generator ids, one per kind. */
const SOURCING_GENERATOR: Record<Kind, string> = { prices: "sourcing.prices", alternates: "sourcing.alternates" };

/** Asks, stores the answer as a research row, and saves the drafts on the part. `confirm` must be true: the call is billed. */
export async function researchPart(projectId: string, partId: number, kind: Kind, confirm: boolean, signal?: AbortSignal): Promise<ResearchOutcome> {
  if (confirm !== true) throw new HttpError(400, "This asks Perplexity, which is billed. Confirm to go ahead.");
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section='design/bom'`, [partId, projectId]);
  const part = rows[0];
  if (!part) throw notFound("That part");
  const key = await getSecretFor("perplexity", "apiKey", perplexityBaseUrl());
  if (!key) throw new HttpError(503, "Perplexity is not connected. Add a key in Admin, Credentials.");
  const cur = await currencyOf(projectId);
  const p: Part = { title: part.title, body: part.body, ref: String(part.data.ref ?? ""), partNumber: String((part.data as { partNumber?: string }).partNumber ?? ""), search: String(part.data.search ?? "") };
  const question = questionFor(kind, p, cur);
  const r = await ask({ question, apiKey: key, signal });
  if (!r.ok) throw new HttpError(r.kind === "timeout" ? 504 : r.kind === "rate_limited" ? 429 : r.kind === "not_configured" ? 503 : 502, r.message);
  const today = todayUtc();
  const parsed = parseAnswer(kind, r.answer, r.sources, cur, today);
  return tx(async (c) => {
    const res = await c.query<{ id: string }>(
      "INSERT INTO research (project_id, query, answer, citations, sources, model) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [projectId, `${kind === "prices" ? "Prices" : "Alternates"} for ${part.title}`, r.answer, JSON.stringify(r.sources.map((s) => s.url)), JSON.stringify(r.sources.map(toStoredSource)), r.model]
    );
    const researchId = Number(res.rows[0].id);
    const lock = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [partId])).rows[0];
    if (!lock) throw notFound("That part");
    const source = (url: string) => ({ kind: "research" as const, id: researchId, title: url.slice(0, 300) });
    const out = await saveDrafts(
      {
        projectId,
        generator: SOURCING_GENERATOR[kind],
        label: `${kind === "prices" ? "Check prices" : "Find alternates"} for "${part.title}"`,
        targetStore: "design/bom",
        model: r.model,
        provider: "perplexity",
        dropped: parsed.dropped.map((d) => ({ title: d.split(":")[0], reason: d.split(":").slice(1).join(":").trim() || d })),
        record: { itemId: partId, researchId, kind, costUsd: r.costUsd ?? null },
        drafts: parsed.drafts.map((d) =>
          d.offer
            ? {
                proposed: { title: `Offer: ${d.offer.supplier}, ${d.offer.price} ${cur} per ${d.offer.packSize}`, body: d.offer.stock ?? "", data: {}, op: { op: "append" as const, field: "sourcing.offers" }, itemId: partId },
                data: { value: { ...d.offer, researchId } },
                sources: [source(d.citation)],
              }
            : {
                proposed: { title: `Alternate: ${d.alternate!.name}${d.alternate!.partNumber ? ` (${d.alternate!.partNumber})` : ""}`, body: d.alternate!.whatChanges ?? "", data: {}, op: { op: "append" as const, field: "sourcing.alternates" }, itemId: partId },
                data: { value: { ...d.alternate!, researchId } },
                sources: [source(d.citation)],
              }
        ),
      },
      c
    );
    const drafts = out.drafts;
    await logEventIn(c, projectId, "sourcing.researched", `Asked research for ${kind} on "${part.title}": ${drafts.length} draft${drafts.length === 1 ? "" : "s"} saved for review, ${parsed.dropped.length} dropped`, {
      itemId: partId, researchId, kind, costUsd: r.costUsd ?? null, drafts: drafts.length, dropped: parsed.dropped, runId: out.runId,
    });
    return { researchId, drafts, dropped: parsed.dropped, costUsd: r.costUsd ?? null, sources: r.sources.length };
  });
}
