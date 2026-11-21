// Proposes the links Traceability shows as gaps: which test checks which requirement, which part a requirement
// needs. Each proposal is a replacement of one requirement that adds `tests` and `parts` keys; approving it runs
// the same write as a hand edit, so mirrorLinks sets the other end too (the test's or part's `requirements`).
// Both rows are cited as sources, and the model's reason for each link goes on the draft as its "why".
import { z } from "zod";
import { traceOf } from "@/lib/trace/coverage";
import { keyOf, listOf } from "@/lib/trace/spec";
import type { Item } from "@/lib/types";
import type { Generator } from "../types";
import { RULES, block, clip, conceptHeader } from "../prompt";

const link = z.object({
  key: z.string().min(1).max(120).describe("the key of the test or part, as listed after key="),
  because: z.string().min(1).max(400).describe("one sentence: why this test checks the requirement, or why the requirement needs this part"),
});

const linkRow = z.object({
  requirement: z.string().min(1).max(120).describe("the key of the requirement"),
  tests: z.array(link).max(20).default([]),
  parts: z.array(link).max(20).default([]),
});

/** Rows that have a key, because a link names its target by key. */
const keyed = (rows: Item[] | undefined) => (rows ?? []).filter((i) => keyOf(i.data));

const allRows = (ctx: { rows: Record<string, Item[]> }) => Object.values(ctx.rows).flat();

/** What Traceability lists as gaps, among the rows that can be linked by key. */
function linkGaps(rows: Item[]) {
  const t = traceOf(rows);
  return {
    untested: t.untested.filter((r) => keyOf(r.data)),
    orphanTests: t.orphanTests.filter((r) => keyOf(r.data)),
    unusedParts: t.unusedParts.filter((r) => keyOf(r.data)),
    noParts: t.requirements.filter((r) => keyOf(r.data) && !t.linksOf(r).parts.length),
  };
}

export const traceLinks: Generator<z.infer<typeof linkRow>> = {
  id: "trace-links",
  label: "Traceability links",
  action: "Draft links with AI",
  from: ["design/requirements", "prototype/tests", "design/bom"],
  to: "design/requirements",
  kind: "links",
  applies: () => true,
  revises: false,
  blocked(ctx) {
    const reqs = keyed(ctx.rows["design/requirements"]);
    if (!reqs.length) return "No requirement has a key yet, so a link cannot name it. Give requirements a key, or draft requirements first.";
    if (!keyed(ctx.rows["prototype/tests"]).length && !keyed(ctx.rows["design/bom"]).length) return "There is no test or part with a key to link to yet.";
    const g = linkGaps(allRows(ctx));
    return g.untested.length || g.orphanTests.length || g.unusedParts.length || g.noParts.length ? "" : "There are no gaps to link.";
  },
  buildPrompt(ctx) {
    const g = linkGaps(allRows(ctx));
    const keys = (rows: Item[]) => rows.map((r) => keyOf(r.data)).join(", ") || "none";
    return {
      system: [
        "You propose links between the requirements of a product, the tests that check them and the parts they need.",
        "A test checks a requirement only when passing it would show the requirement is met. A requirement needs a part only when the product could not meet it without that part.",
        "Propose a link only where the rows say so; a requirement left without a link is better than a guessed one. Use only the keys listed, and only link rows of the right kind (tests to requirements, parts to requirements).",
        "Prefer filling the gaps: requirements with no test, tests that check no requirement, parts no requirement needs. Do not repeat a link that exists.",
        "Return one row per requirement that gets new links, with the key of the requirement, and for each link the key of the test or part and one sentence saying why.",
        RULES,
      ].join("\n"),
      user: [
        conceptHeader(ctx),
        block("Requirements (key= is what you name)", keyed(ctx.rows["design/requirements"])),
        block("Tests", keyed(ctx.rows["prototype/tests"])),
        block("Parts", keyed(ctx.rows["design/bom"]), { skip: ["geometry", "schematic", "pins", "pinRoles", "sourcing"] }),
        `Gaps: requirements with no test: ${keys(g.untested)}. Requirements with no part: ${keys(g.noParts)}. Tests that check nothing: ${keys(g.orphanTests)}. Parts nothing needs: ${keys(g.unusedParts)}.`,
      ].join("\n\n"),
    };
  },
  schema: linkRow,
  toDraft(row, ctx, run) {
    const req = (ctx.rows["design/requirements"] ?? []).find((i) => keyOf(i.data) === row.requirement.trim());
    if (!req) return { ok: false, reason: `there is no requirement with the key "${row.requirement}"` };
    const seen = (run.memo.get("requirements") as Set<number> | undefined) ?? new Set<number>();
    run.memo.set("requirements", seen);
    if (seen.has(req.id)) return { ok: false, reason: `the requirement "${req.title}" appears twice` };
    seen.add(req.id);

    const notes: string[] = [];
    const pick = (list: z.infer<typeof link>[], store: string, field: "tests" | "parts") => {
      const rows = new Map(keyed(ctx.rows[store]).map((i) => [keyOf(i.data), i]));
      const had = new Set(listOf(req.data, field));
      // A link written at the other end (the test's own requirements list) counts as present.
      for (const i of rows.values()) if (listOf(i.data, "requirements").includes(row.requirement.trim())) had.add(keyOf(i.data));
      const out: { item: Item; because: string }[] = [];
      for (const l of list) {
        const item = rows.get(l.key.trim());
        if (!item) notes.push(`${clip(req.title, 60)}: "${l.key}" is not a ${field === "tests" ? "test" : "part"} with a key, so that link was left out.`);
        else if (!had.has(l.key.trim()) && !out.some((o) => o.item.id === item.id)) out.push({ item, because: l.because.trim() });
      }
      return out;
    };
    const tests = pick(row.tests, "prototype/tests", "tests");
    const parts = pick(row.parts, "design/bom", "parts");
    if (!tests.length && !parts.length) return { ok: false, reason: `it proposes no new link for "${req.title}"` };

    const reason = [...tests.map((t) => `test "${t.item.title}": ${t.because}`), ...parts.map((p) => `part "${p.item.title}": ${p.because}`)].join(" ");
    return {
      ok: true,
      notes,
      drafts: [
        {
          title: req.title,
          body: req.body,
          data: { ...req.data, tests: [...listOf(req.data, "tests"), ...tests.map((t) => keyOf(t.item.data))], parts: [...listOf(req.data, "parts"), ...parts.map((p) => keyOf(p.item.data))] },
          op: { op: "replace", reason },
          itemId: req.id,
          basedOn: [req.id, ...tests.map((t) => t.item.id), ...parts.map((p) => p.item.id)],
        },
      ],
    };
  },
};

