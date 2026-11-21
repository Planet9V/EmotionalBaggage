// Parts and wiring to assembly steps with order and minutes, and to acceptance tests (plan 4.6).
import { z } from "zod";
import { keys, partsByRef } from "@/lib/domain";
import type { Generator } from "../types";
import { RULES, basedOn, block, clip, conceptHeader, critiqueBlock, nextKey, replaces, reviseBlock, revisionTarget } from "../prompt";

const always = () => true;

const stepRow = z.object({
  step: z.number().int().min(1).max(500).describe("this step's number, 1 for the first"),
  title: z.string().min(1).max(300),
  detail: z.string().max(4000).describe("what to do and what to check before moving on"),
  minutes: z.number().min(0).max(100_000).describe("how long it takes, in minutes"),
  after: z.array(z.number().int().min(1)).max(50).optional().describe("numbers of earlier steps this one waits on; leave out to wait on the step before"),
  parts: z.array(z.string().max(40)).max(200).optional().describe("references of the parts this step installs or works on"),
  basedOn,
  replaces,
});

export const assembly: Generator<z.infer<typeof stepRow>> = {
  id: "assembly",
  label: "Assembly steps",
  action: "Draft assembly steps",
  from: ["design/bom", "design/wiring", "design/requirements", "prototype/printing", "prototype/assembly"],
  to: "prototype/assembly",
  kind: "section",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["design/bom"]?.length ? "" : "The parts list is empty. Draft or enter parts first."),
  buildPrompt: (ctx) => ({
    system: [
      "You write the assembly of a first prototype as numbered steps, from laying out the parts to a finished unit ready for its acceptance tests.",
      "Each step has a number, what to do, what to check before moving on, how many minutes it takes, which earlier steps it waits on, and the references of the parts it uses.",
      "Steps that can run in parallel (printing while soldering) wait only on what they really need.",
      "Minutes are an honest working estimate for one person; say in the detail when a figure is a guess.",
      "Use only parts in the parts list. Between 4 and 20 steps.",
      RULES,
    ].join("\n"),
    user: [
      conceptHeader(ctx),
      block("Parts", ctx.rows["design/bom"]),
      block("Wires", ctx.rows["design/wiring"]),
      block("Print jobs", ctx.rows["prototype/printing"]),
      block("Requirements", ctx.rows["design/requirements"]),
      ctx.revise ? "" : block("Steps already on record", ctx.rows["prototype/assembly"]),
      reviseBlock(ctx),
      critiqueBlock(ctx),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
  schema: stepRow,
  toDraft(row, ctx, run) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    // Step numbers become keys unique in the concept; "after" is translated from numbers to keys.
    const numbers = (run.memo.get("steps") as Map<number, string> | undefined) ?? new Map<number, string>();
    run.memo.set("steps", numbers);
    if (numbers.has(row.step)) return { ok: false, reason: `step number ${row.step} appears twice` };
    const key = t.item && typeof t.item.data.key === "string" && t.item.data.key ? t.item.data.key : nextKey("asm-", run.keys);
    const prev = [...numbers.entries()].filter(([n]) => n < row.step).sort((a, b) => b[0] - a[0])[0]?.[1];
    numbers.set(row.step, key);
    const notes: string[] = [];
    let after: string[];
    if (t.item) after = row.after ? row.after.map((n) => numbers.get(n)).filter((k): k is string => !!k) : keys(t.item.data.after);
    else if (row.after) {
      after = row.after.map((n) => numbers.get(n)).filter((k): k is string => !!k);
      if (after.length < row.after.length) notes.push(`Step ${row.step}: waits on step numbers that come later or do not exist; those were left out.`);
    } else after = prev ? [prev] : [];
    const refs = new Set(partsByRef(ctx.rows["design/bom"] ?? []).keys());
    const used = (row.parts ?? []).map((r) => r.trim()).filter(Boolean);
    const knownParts = used.filter((r) => refs.has(r));
    if (knownParts.length < used.length) notes.push(`Step ${row.step}: part references not in the parts list were left out (${used.filter((r) => !refs.has(r)).join(", ")}).`);
    const minutes = Math.round(row.minutes);
    const data: Record<string, unknown> = { ...(t.item?.data ?? {}), key, order: row.step, after, minutes, time: `${minutes} min`, ...(knownParts.length ? { parts: knownParts } : {}) };
    return {
      ok: true,
      notes,
      drafts: [{ title: clip(row.title), body: row.detail.trim(), data, op: t.item ? { op: "replace" } : { op: "add" }, itemId: t.item?.id, basedOn: row.basedOn }],
    };
  },
};

const testRow = z.object({
  title: z.string().min(1).max(300),
  method: z.string().max(4000).describe("how to run the test"),
  pass: z.string().min(1).max(400).describe("the pass condition, measurable"),
  requirements: z.array(z.string().max(120)).min(1).max(50).describe("keys of the requirements this test checks"),
  basedOn,
  replaces,
});

export const tests: Generator<z.infer<typeof testRow>> = {
  id: "tests",
  label: "Acceptance tests",
  action: "Draft acceptance tests",
  from: ["design/requirements", "design/bom", "design/wiring", "prototype/tests"],
  to: "prototype/tests",
  kind: "section",
  applies: always,
  revises: true,
  blocked: (ctx) =>
    (ctx.rows["design/requirements"] ?? []).some((i) => typeof i.data.key === "string" && i.data.key)
      ? ""
      : "No requirement has a key yet, so a test cannot name what it checks. Draft requirements, or give requirements a key.",
  buildPrompt: (ctx) => ({
    system: [
      "You write the acceptance tests a prototype must pass before it counts as done.",
      "Each test names the keys of the requirements it checks, says how to run it, and gives a pass condition that can be measured or observed.",
      "Every requirement with a key should be checked by at least one test. Use only the keys listed.",
      RULES,
    ].join("\n"),
    user: [
      conceptHeader(ctx),
      block("Requirements (key= is what you list in requirements)", ctx.rows["design/requirements"]),
      block("Parts", ctx.rows["design/bom"]),
      block("Wires", ctx.rows["design/wiring"]),
      ctx.revise ? "" : block("Tests already on record", ctx.rows["prototype/tests"]),
      reviseBlock(ctx),
      critiqueBlock(ctx),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
  schema: testRow,
  toDraft(row, ctx) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    const reqKeys = new Set((ctx.rows["design/requirements"] ?? []).map((i) => i.data.key).filter((k): k is string => typeof k === "string" && k !== ""));
    const named = row.requirements.map((k) => k.trim()).filter(Boolean);
    const known = [...new Set(named.filter((k) => reqKeys.has(k)))];
    if (!known.length) return { ok: false, reason: `it names no requirement that exists (${named.join(", ") || "none"})` };
    const notes = known.length < named.length ? [`${clip(row.title, 60)}: requirement keys that do not exist were left out (${named.filter((k) => !reqKeys.has(k)).join(", ")}).`] : [];
    return {
      ok: true,
      notes,
      drafts: [
        {
          title: clip(row.title),
          body: row.method.trim(),
          data: { ...(t.item?.data ?? {}), pass: row.pass.trim(), requirements: known },
          op: t.item ? { op: "replace" } : { op: "add" },
          itemId: t.item?.id,
          basedOn: row.basedOn,
        },
      ],
    };
  },
};
