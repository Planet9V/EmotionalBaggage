// Running a generator: gather the source rows, ask the reasoning model through the model layer, check
// every proposed row against the generator's row schema and then the target section's own schema,
// and save the rows that pass as drafts. Nothing is written to `items` here.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentActor } from "@/lib/actor";
import { HttpError, notFound } from "@/lib/api/route";
import { STORE_STATUSES } from "@/lib/api/schemas";
import { completeJson, getReasoning, ModelError } from "@/lib/ai/models";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { dataSchemaFor } from "@/lib/domain/schemas";
import { productType as productTypeInfo } from "@/lib/productTypes";
import type { Item } from "@/lib/types";
import { generator as findGenerator } from "./registry";
import { toDraftRow, type DraftDbRow, DRAFT_COLS } from "./store";
import { readsText, type DraftSource, type DroppedRow, type RunResult } from "./shared";
import type { ConceptInfo, GenContext, Generator, Proposed, RunState } from "./types";
import { knownIds } from "./prompt";

/** Lists of rows sent to the model and answered by it can be long; two minutes, not the usual one. */
export const DRAFT_TIMEOUT_MS = 120_000;
/** Sources recorded per draft when the model names none: the rows it was given, up to this many. */
const MAX_SOURCES = 40;

export async function readConcept(projectId: string): Promise<ConceptInfo> {
  const r = await q<{ id: string; name: string; one_liner: string; product_type: string }>("SELECT id, name, one_liner, product_type FROM projects WHERE id=$1", [projectId]);
  if (!r.length) throw notFound("That concept");
  return { id: r[0].id, name: r[0].name, oneLiner: r[0].one_liner ?? "", productType: r[0].product_type ?? "electronics" };
}

/** Rows of these stores, in their saved order. */
export async function readStores(projectId: string, stores: string[]): Promise<Record<string, Item[]>> {
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [projectId, stores])).map(toItem);
  const out: Record<string, Item[]> = Object.fromEntries(stores.map((s) => [s, [] as Item[]]));
  for (const r of rows) out[r.section]?.push(r);
  return out;
}

/** The context a generator works from. */
export async function buildContext(g: Generator<Record<string, unknown>>, concept: ConceptInfo, opts: { reviseIds?: number[]; why?: string; critique?: string } = {}): Promise<GenContext> {
  const stores = [...new Set([...g.from, g.to])];
  const rows = await readStores(concept.id, stores);
  const used = await q<{ key: string | null; ref: string | null }>(
    "SELECT data->>'key' AS key, CASE WHEN section='design/bom' THEN data->>'ref' END AS ref FROM items WHERE project_id=$1 AND (data ? 'key' OR data ? 'ref')",
    [concept.id]
  );
  const ctx: GenContext = {
    concept,
    rows: Object.fromEntries(g.from.map((s) => [s, rows[s] ?? []])),
    existing: rows[g.to] ?? [],
    usedKeys: new Set(used.map((u) => u.key).filter((k): k is string => !!k)),
    usedRefs: new Set(used.map((u) => u.ref).filter((k): k is string => !!k)),
    ...(opts.critique ? { critique: opts.critique } : {}),
  };
  if (opts.reviseIds) {
    const byId = new Map(ctx.existing.map((i) => [i.id, i]));
    const items = opts.reviseIds.map((id) => byId.get(id));
    const missing = opts.reviseIds.filter((_, k) => !items[k]);
    if (missing.length) throw new HttpError(400, `Rows ${missing.map((m) => `#${m}`).join(", ")} are not in ${g.label} for this concept.`);
    ctx.revise = { items: items as Item[], why: opts.why ?? "" };
  }
  return ctx;
}

/** The output the model is asked for: { rows: [...] }, each row described by the generator's schema. */
const envelope = z.object({ rows: z.array(z.record(z.string(), z.unknown())).max(200) });

export function rowInstruction(g: Generator<Record<string, unknown>>) {
  return `Answer with a JSON object {"rows": [...]}. Each row must match this JSON Schema:\n${JSON.stringify(z.toJSONSchema(g.schema))}`;
}

/** A name for a row that was dropped, from whatever fields it has. */
function nameOf(raw: Record<string, unknown>) {
  for (const k of ["title", "headline", "question", "ref", "from"]) if (typeof raw[k] === "string" && raw[k]) return String(raw[k]).slice(0, 120);
  return "(untitled row)";
}

const issueText = (e: z.ZodError) => {
  const i = e.issues[0];
  return `${i?.path.join(".") || "(row)"}: ${i?.message ?? "invalid"}`;
};

export type Checked = { proposed: Proposed; data: Record<string, unknown>; sources: DraftSource[] };

/**
 * Turns the model's raw rows into drafts ready to save, and the rows dropped with their reasons.
 * Pure apart from what the generator does; exported for tests.
 */
export function checkRows(g: Generator<Record<string, unknown>>, ctx: GenContext, raws: Record<string, unknown>[]) {
  const kept: Checked[] = [];
  const dropped: DroppedRow[] = [];
  const notes: string[] = [];
  const run: RunState = { index: 0, keys: new Set(ctx.usedKeys), refs: new Set(ctx.usedRefs), memo: new Map() };
  const known = knownIds(ctx);
  const allSources = Object.values(ctx.rows).flat();
  const byId = new Map([...allSources, ...(ctx.revise?.items ?? [])].map((i) => [i.id, i]));
  const schema = dataSchemaFor(g.to);
  for (const raw of raws) {
    const parsed = g.schema.safeParse(raw);
    if (!parsed.success) {
      dropped.push({ title: nameOf(raw), reason: `it did not match the expected shape (${issueText(parsed.error)})` });
      continue;
    }
    const out = g.toDraft(parsed.data, ctx, run);
    run.index++;
    if (!out.ok) {
      dropped.push({ title: nameOf(raw), reason: out.reason });
      continue;
    }
    notes.push(...(out.notes ?? []));
    for (const p of out.drafts) {
      const title = p.title.trim();
      if (!title) {
        dropped.push({ title: nameOf(raw), reason: "it has no title" });
        continue;
      }
      let data = p.data;
      if (p.op.op !== "remove") {
        const r = schema.safeParse(data);
        if (!r.success) {
          dropped.push({ title, reason: `the ${g.label.toLowerCase()} section does not accept it (${issueText(r.error)})` });
          continue;
        }
        data = r.data;
      }
      const cited = (p.basedOn ?? []).filter((id) => known.has(id) && byId.has(id));
      const from = cited.length ? cited.map((id) => byId.get(id)!) : allSources.slice(0, MAX_SOURCES);
      const sources: DraftSource[] = from.map((i) => ({ kind: "item", id: i.id, title: i.title, section: i.section }));
      kept.push({ proposed: { ...p, title: title.slice(0, 300), body: p.body.slice(0, 20_000) }, data, sources });
    }
  }
  return { kept, dropped, notes };
}

export type RunOptions = {
  projectId: string;
  generatorId: string;
  /** realignment and optimisation: the existing rows of the target store that may change */
  reviseIds?: number[];
  why?: string;
  critique?: string;
  /** mark earlier undecided drafts of this generator as superseded; without it a run with such drafts is refused (409) */
  supersede?: boolean;
  signal?: AbortSignal;
  /** extra lines recorded with the run in the activity log (an optimisation's before) */
  record?: Record<string, unknown>;
};

export async function runGenerator(o: RunOptions): Promise<RunResult> {
  const concept = await readConcept(o.projectId);
  const g = findGenerator(o.generatorId);
  if (!g) throw new HttpError(400, `There is no generator called "${o.generatorId}".`);
  if (!g.applies(concept.productType)) {
    throw new HttpError(400, `${g.label} does not apply to a concept of type "${productTypeInfo(concept.productType).label}".`);
  }
  if (!(g.to in STORE_STATUSES)) throw new HttpError(500, `The generator ${g.id} writes to ${g.to}, which is not a section.`);
  if (o.reviseIds && !g.revises) throw new HttpError(400, `${g.label} cannot revise existing rows.`);
  const ctx = await buildContext(g, concept, { reviseIds: o.reviseIds, why: o.why, critique: o.critique });
  const blocked = g.blocked(ctx);
  if (blocked && !ctx.revise) throw new HttpError(400, blocked);

  const pending = await q<{ n: number }>("SELECT count(*)::int AS n FROM drafts WHERE project_id=$1 AND generator=$2 AND status='draft'", [o.projectId, g.id]);
  if (pending[0].n > 0 && !o.supersede) {
    throw new HttpError(
      409,
      `${pending[0].n} ${pending[0].n === 1 ? "draft" : "drafts"} from an earlier run of ${g.label} ${pending[0].n === 1 ? "is" : "are"} still waiting. Confirm to mark ${pending[0].n === 1 ? "it" : "them"} superseded and run again.`,
      { pending: pending[0].n }
    );
  }

  const reasoning = await getReasoning();
  if (!reasoning.ok) throw new ModelError(503, reasoning.reason, "not-configured");
  const prompt = g.buildPrompt(ctx);
  const res = await completeJson({
    use: reasoning,
    system: `${prompt.system}\n\n${rowInstruction(g)}`,
    messages: [{ role: "user", content: prompt.user }],
    schema: envelope,
    maxOutputTokens: 8000,
    temperature: 0.2,
    timeoutMs: DRAFT_TIMEOUT_MS,
    signal: o.signal,
  });

  const { kept, dropped, notes } = checkRows(g, ctx, res.object.rows);
  const runId = randomUUID();
  const counts = Object.fromEntries(Object.entries(ctx.rows).map(([s, r]) => [s, r.length]));

  const { saved, superseded } = await tx(async (c) => {
    let superseded = 0;
    if (pending[0].n > 0) {
      const r = await c.query(
        "UPDATE drafts SET status='rejected', reason='superseded', decided_at=now(), decided_by=$3 WHERE project_id=$1 AND generator=$2 AND status='draft'",
        [o.projectId, g.id, currentActor()]
      );
      superseded = r.rowCount ?? 0;
    }
    const saved: DraftDbRow[] = [];
    for (const k of kept) {
      const r = await c.query<DraftDbRow>(
        `INSERT INTO drafts (project_id, generator, target_store, title, body, data, sources, model, provider, run_id, item_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${DRAFT_COLS}`,
        [
          o.projectId,
          g.id,
          g.to,
          k.proposed.title,
          k.proposed.body,
          JSON.stringify({ ...k.data, _draft: k.proposed.op }),
          JSON.stringify(k.sources),
          res.info.model,
          res.info.provider,
          runId,
          k.proposed.itemId ?? null,
        ]
      );
      saved.push(r.rows[0]);
    }
    await logEventIn(
      c,
      o.projectId,
      "draft.run",
      `${g.label}: the AI drafted ${saved.length} ${saved.length === 1 ? "row" : "rows"} for review (${dropped.length} dropped), from ${readsText(counts)}`,
      { runId, generator: g.id, targetStore: g.to, drafts: saved.length, dropped, superseded, model: res.info.model, provider: res.info.provider, path: res.path, revise: o.reviseIds ?? null, ...(o.record ?? {}) }
    );
    return { saved, superseded };
  });

  return {
    runId,
    generator: g.id,
    targetStore: g.to,
    drafts: saved.map(toDraftRow),
    dropped,
    superseded,
    model: res.info.model,
    provider: res.info.provider,
    path: res.path,
    notes,
  };
}
