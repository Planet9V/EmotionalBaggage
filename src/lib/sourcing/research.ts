// "Find alternates" and "Check prices": ask the research client (Perplexity; billed) and keep what comes back as drafts.
// A draft is saved only when the page it names is among the sources the answer cited. A price with no such page is dropped and
// reported, never stored as a fact. The answer itself is saved as a research row the way the Research screen saves one.
// (When the drafts engine of another branch is merged, saveDrafts is the one function to repoint.)
import { ITEM_COLS, logEventIn, q, tx, type ItemRow } from "@/lib/db";
import { HttpError, notFound } from "@/lib/api/route";
import { getCredential } from "@/lib/settings";
import { ask, type Source } from "@/lib/research/perplexity";
import { toStoredSource } from "@/lib/research/schemas";
import { readSourcing, newId, offerSchema, alternateSchema, type Draft, type Sourcing } from "./schemas";

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

export type ResearchOutcome = { researchId: number; drafts: Draft[]; dropped: string[]; costUsd: number | null; sources: number };

/** Asks, stores the answer as a research row, and saves the drafts on the part. `confirm` must be true: the call is billed. */
export async function researchPart(projectId: string, partId: number, kind: Kind, confirm: boolean, signal?: AbortSignal): Promise<ResearchOutcome> {
  if (confirm !== true) throw new HttpError(400, "This asks Perplexity, which is billed. Confirm to go ahead.");
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section='design/bom'`, [partId, projectId]);
  const part = rows[0];
  if (!part) throw notFound("That part");
  const key = await getCredential("perplexity", "apiKey");
  if (!key) throw new HttpError(503, "Perplexity is not connected. Add a key in Admin, Credentials.");
  const cur = (await q<{ currency: string }>("SELECT currency FROM projects WHERE id=$1", [projectId]))[0]?.currency ?? "USD";
  const p: Part = { title: part.title, body: part.body, ref: String(part.data.ref ?? ""), partNumber: String((part.data as { partNumber?: string }).partNumber ?? ""), search: String(part.data.search ?? "") };
  const question = questionFor(kind, p, cur);
  const r = await ask({ question, apiKey: key, signal });
  if (!r.ok) throw new HttpError(r.kind === "timeout" ? 504 : r.kind === "rate_limited" ? 429 : r.kind === "not_configured" ? 503 : 502, r.message);
  const today = new Date().toISOString().slice(0, 10);
  const parsed = parseAnswer(kind, r.answer, r.sources, cur, today);
  return tx(async (c) => {
    const res = await c.query<{ id: string }>(
      "INSERT INTO research (project_id, query, answer, citations, sources, model) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [projectId, `${kind === "prices" ? "Prices" : "Alternates"} for ${part.title}`, r.answer, JSON.stringify(r.sources.map((s) => s.url)), JSON.stringify(r.sources.map(toStoredSource)), r.model]
    );
    const researchId = Number(res.rows[0].id);
    const now = new Date().toISOString();
    const drafts: Draft[] = parsed.drafts.map((d) => ({
      ...d, id: newId("d"), createdAt: now, model: r.model, researchId,
      ...(d.offer ? { offer: { ...d.offer, researchId } } : {}), ...(d.alternate ? { alternate: { ...d.alternate, researchId } } : {}),
    }));
    const cur2 = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [partId])).rows[0];
    if (!cur2) throw notFound("That part");
    const s: Sourcing = readSourcing(cur2.data);
    const next: Sourcing = { ...s, drafts: [...s.drafts, ...drafts].slice(-40) };
    await c.query("UPDATE items SET data = data || $2::jsonb, updated_at = now() WHERE id=$1", [partId, JSON.stringify({ sourcing: next })]);
    await logEventIn(c, projectId, "sourcing.researched", `Asked research for ${kind} on "${part.title}": ${drafts.length} draft${drafts.length === 1 ? "" : "s"} saved, ${parsed.dropped.length} dropped`, {
      itemId: partId, researchId, kind, costUsd: r.costUsd ?? null, drafts: drafts.length, dropped: parsed.dropped,
    });
    return { researchId, drafts, dropped: parsed.dropped, costUsd: r.costUsd ?? null, sources: r.sources.length };
  });
}
