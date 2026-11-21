// The three optimisation actions (plan 4.9). The model proposes; the before and after are measured
// from the rows (measure.ts), never taken from the model.
import { z } from "zod";
import type { Generator } from "../types";
import { RULES, basedOn, block, clip, conceptHeader, revisionTarget } from "../prompt";

const always = () => true;

const costRow = z.object({
  replaces: z.number().int().describe("id of the part to substitute"),
  title: z.string().min(1).max(300).describe("the substitute part"),
  spec: z.string().max(2000),
  search: z.string().max(400).optional(),
  reason: z.string().min(1).max(1000).describe("why it should cost less and what it gives up"),
  basedOn,
});

export const optimiseCost: Generator<z.infer<typeof costRow>> = {
  id: "optimise-cost",
  label: "Lower parts cost",
  action: "Propose cheaper substitutes",
  from: ["design/bom", "design/requirements"],
  to: "design/bom",
  kind: "optimise",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["design/bom"]?.length ? "" : "The parts list is empty."),
  buildPrompt: (ctx) => ({
    system: [
      "You look for cheaper substitutes for parts in a parts list that still meet every requirement.",
      "Propose a substitute only where a cheaper class of part plainly exists (a module instead of a dev board, a stock part instead of a custom one, fewer features).",
      "Do not state any price or saving as a figure: the user prices substitutes. Say why it should cost less and what it gives up.",
      "Return one row per substitution, with \"replaces\" set to the part's id. Return no rows if nothing is worth changing.",
      RULES,
    ].join("\n"),
    user: [conceptHeader(ctx), block("Parts (line= is the user's entered cost)", ctx.rows["design/bom"]), block("Requirements", ctx.rows["design/requirements"])].join("\n\n"),
  }),
  schema: costRow,
  toDraft(row, ctx) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok || !t.item) return { ok: false, reason: t.ok ? "it does not name a part" : t.reason };
    const data: Record<string, unknown> = { ...t.item.data };
    // The substitute is unpriced until the user enters its cost.
    delete data.line;
    delete data.asin;
    if (row.search) data.search = row.search.trim();
    return { ok: true, drafts: [{ title: clip(row.title), body: row.spec.trim(), data, op: { op: "replace", reason: row.reason.trim() }, itemId: t.item.id, basedOn: row.basedOn }] };
  },
};

const partsRow = z.object({
  action: z.enum(["remove", "merge"]),
  replaces: z.number().int().describe("remove: the part to remove; merge: the part that remains, redesigned to do the others' work"),
  mergeWith: z.array(z.number().int()).max(20).optional().describe("merge: ids of the parts that go away"),
  title: z.string().max(300).optional().describe("merge: the new name of the part that remains"),
  spec: z.string().max(2000).optional().describe("merge: what the part that remains now is"),
  reason: z.string().min(1).max(1000).describe("the design-for-assembly reason: does it move, need a different material, or need to come apart for service?"),
  basedOn,
});

export const optimiseParts: Generator<z.infer<typeof partsRow>> = {
  id: "optimise-parts",
  label: "Fewer parts",
  action: "Check the design for assembly",
  from: ["design/bom", "design/requirements", "prototype/assembly"],
  to: "design/bom",
  kind: "optimise",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["design/bom"]?.length ? "" : "The parts list is empty."),
  buildPrompt: (ctx) => ({
    system: [
      "You run a design-for-assembly check on a parts list. For each part ask: does it move relative to its neighbours, must it be a different material, must it come apart for service? A part that answers no to all three is a candidate to merge into a neighbour or remove.",
      "Look hard at fasteners: snap fits, printed features or one fastener type in place of several.",
      "Return one row per proposal: action \"remove\" with the part's id, or \"merge\" with the part that remains (replaces), the parts that go away (mergeWith), and the remaining part's new name and description.",
      "Never remove a part a requirement plainly needs. Return no rows if nothing should change.",
      RULES,
    ].join("\n"),
    user: [conceptHeader(ctx), block("Parts", ctx.rows["design/bom"]), block("Requirements", ctx.rows["design/requirements"]), block("Assembly steps", ctx.rows["prototype/assembly"])].join("\n\n"),
  }),
  schema: partsRow,
  toDraft(row, ctx, run) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok || !t.item) return { ok: false, reason: t.ok ? "it does not name a part" : t.reason };
    const taken = (run.memo.get("taken") as Set<number> | undefined) ?? new Set<number>();
    run.memo.set("taken", taken);
    const reason = row.reason.trim();
    if (row.action === "remove") {
      if (taken.has(t.item.id)) return { ok: false, reason: `part #${t.item.id} is already in another proposal` };
      taken.add(t.item.id);
      return { ok: true, drafts: [{ title: t.item.title, body: t.item.body, data: { ...t.item.data }, op: { op: "remove", reason }, itemId: t.item.id, basedOn: row.basedOn }] };
    }
    const gone = (row.mergeWith ?? []).filter((id) => id !== t.item!.id);
    if (!gone.length) return { ok: false, reason: "a merge must name the parts that go away" };
    const others = gone.map((id) => ctx.revise?.items.find((i) => i.id === id));
    if (others.some((o) => !o)) return { ok: false, reason: "a merge names a part that is not in the list" };
    if ([t.item.id, ...gone].some((id) => taken.has(id))) return { ok: false, reason: "a part in this merge is already in another proposal" };
    [t.item.id, ...gone].forEach((id) => taken.add(id));
    const kept = {
      title: row.title ? clip(row.title) : t.item.title,
      body: row.spec?.trim() || t.item.body,
      data: { ...t.item.data },
      op: { op: "replace" as const, reason: `Merged with ${others.map((o) => o!.title).join(", ")}. ${reason}` },
      itemId: t.item.id,
      basedOn: row.basedOn,
    };
    const removed = others.map((o) => ({ title: o!.title, body: o!.body, data: { ...o!.data }, op: { op: "remove" as const, reason: `Merged into ${kept.title}. ${reason}` }, itemId: o!.id, basedOn: row.basedOn }));
    return { ok: true, drafts: [kept, ...removed] };
  },
};

const printRow = z.object({
  replaces: z.number().int().describe("id of the print job"),
  settings: z.string().min(1).max(400).describe("the new slicer settings: layer height, walls, infill"),
  orientation: z.string().max(400).optional(),
  split: z.string().max(1000).optional().describe("if the part should be split into pieces, how and where"),
  reason: z.string().min(1).max(1000).describe("why this prints faster and what it costs in strength or finish"),
  basedOn,
});

export const optimisePrint: Generator<z.infer<typeof printRow>> = {
  id: "optimise-print",
  label: "Shorter print time",
  action: "Propose faster print settings",
  from: ["prototype/printing", "design/bom", "design/requirements"],
  to: "prototype/printing",
  kind: "optimise",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["prototype/printing"]?.length ? "" : "There are no print jobs yet."),
  buildPrompt: (ctx) => ({
    system: [
      "You propose changes to 3D print jobs that shorten print time: fewer walls, lower infill, a taller layer, a better orientation (less support), or splitting a part.",
      "Keep what the requirements need: strength where the part is loaded, finish where it is seen.",
      "Do not state a print time: the job has to be sliced again to know it. Say why it should be faster and what it costs.",
      "Return one row per job to change, with \"replaces\" set to its id. Return no rows if nothing should change.",
      RULES,
    ].join("\n"),
    user: [conceptHeader(ctx), block("Print jobs", ctx.rows["prototype/printing"]), block("Parts", ctx.rows["design/bom"]), block("Requirements", ctx.rows["design/requirements"])].join("\n\n"),
  }),
  schema: printRow,
  toDraft(row, ctx) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok || !t.item) return { ok: false, reason: t.ok ? "it does not name a print job" : t.reason };
    const data: Record<string, unknown> = { ...t.item.data, settings: row.settings.trim() };
    if (row.orientation) data.orientation = row.orientation.trim();
    if (row.split) data.split = row.split.trim();
    // The old time no longer applies: the job is "not sliced yet" until the user slices it again.
    data.estimate = "";
    delete data.printMinutes;
    return { ok: true, drafts: [{ title: t.item.title, body: t.item.body, data, op: { op: "replace", reason: row.reason.trim() }, itemId: t.item.id, basedOn: row.basedOn }] };
  },
};
