// The marketing generators (personas, competitors, positioning, names and taglines, the brand voice
// check) on the shared drafting engine (src/lib/ai/drafts). Each market generator keeps its own
// prompt, schema and `toRows`, so every rule it enforces still holds: a competitor price or claim
// without a cited research answer is marked unsourced and never saved as fact, quotations must be
// found word for word in a saved research answer, and a positioning row must still be attacked by the
// reviewer once before it can be approved (src/lib/market/rules.ts, on the row's status change).
// What changes is the path: the rows are drafts with their sources, and approving a draft is the only
// way one becomes a row.
import type { z } from "zod";
import type { Generator, GenContext, Proposed, ToDraft } from "@/lib/ai/drafts/types";
import type { DraftSource } from "@/lib/ai/drafts/shared";
import { loadContext } from "./context";
import { GENERATORS, GENERATOR_IDS, type GeneratorId } from "./generators";
import type { MarketContext, SourceRef } from "./generators/types";

/** Engine ids: "market.personas" and so on. */
export const marketGeneratorId = (id: GeneratorId) => `market.${id}`;

/** Where each kind of source a market generator names lives. */
const KIND_STORE: Record<string, string> = {
  brief: "concept/brief",
  claim: "research/claims",
  claims: "research/claims",
  persona: "marketing/personas",
  personas: "marketing/personas",
  competitor: "marketing/competitors",
  competitors: "marketing/competitors",
  requirement: "design/requirements",
  requirements: "design/requirements",
  test: "prototype/tests",
  tests: "prototype/tests",
  name: "concept/names",
  names: "concept/names",
  brand: "marketing/brand",
  positioning: "marketing/positioning",
};

const ACTION: Record<GeneratorId, string> = {
  personas: "Draft personas",
  competitors: "Draft competitors from a research answer",
  positioning: "Draft positioning",
  names: "Draft names and taglines",
  "voice-check": "Check text against the brand voice",
};

function toSource(s: SourceRef): DraftSource {
  if (s.kind === "research") return { kind: "research", id: s.id, title: s.title };
  return { kind: "item", id: s.id, title: s.title, ...(KIND_STORE[s.kind] ? { section: KIND_STORE[s.kind] } : {}) };
}

const marketOf = (ctx: GenContext) => ctx.extra?.market as MarketContext;

function adapt(id: GeneratorId): Generator<Record<string, unknown>> {
  const { generator: m, toRows } = GENERATORS[id];
  // A generator names what it reads as store paths ("marketing/personas"); older ones used kind words. Both count,
  // so Draft with AI says what the generator reads (it said "from nothing yet" while reading personas and competitors).
  const stores = [...new Set(m.from.map((k) => KIND_STORE[k] ?? (k.includes("/") ? k : undefined)).filter((s): s is string => !!s))];
  return {
    id: marketGeneratorId(id),
    label: m.label,
    action: ACTION[id],
    from: stores,
    to: m.to,
    // Every one shows in Draft with AI on its section, where its drafts are reviewed. Competitors and the
    // voice check need what their own screen passes (a research answer, the text), so from the header
    // they show the sentence saying so instead of running.
    kind: "section",
    applies: () => true,
    revises: false,
    load: async (concept, params) => ({ market: await loadContext({ id: concept.id, name: concept.name, one_liner: concept.oneLiner }, params) }),
    blocked: (ctx) => {
      const a = m.applies(marketOf(ctx));
      return a.ok ? "" : a.reason;
    },
    buildPrompt: (ctx) => {
      const p = m.buildPrompt(marketOf(ctx));
      return { system: p.system, user: p.prompt };
    },
    schema: m.schema as unknown as z.ZodType<Record<string, unknown>>,
    toDraft: (row, ctx, run): ToDraft => {
      const out = toRows(row as never, marketOf(ctx), { model: ctx.model ?? "", at: new Date().toISOString() });
      const seen = (run.memo.get("titles") as Set<string> | undefined) ?? new Set<string>();
      run.memo.set("titles", seen);
      const drafts: Proposed[] = [];
      const notes = [...out.notes];
      for (const r of out.rows) {
        if (r.section !== m.to) {
          notes.push(`"${r.title}" was meant for ${r.section}, not ${m.to}, and was left out.`);
          continue;
        }
        const key = r.title.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const from = (r.data.generatedFrom as { sources?: SourceRef[] } | undefined)?.sources ?? [];
        drafts.push({ title: r.title, body: r.body, data: r.data, op: { op: "add" }, sources: from.map(toSource) });
      }
      return { ok: true, drafts, notes };
    },
  };
}

export const MARKET_DRAFT_GENERATORS: Generator<Record<string, unknown>>[] = GENERATOR_IDS.map(adapt);
