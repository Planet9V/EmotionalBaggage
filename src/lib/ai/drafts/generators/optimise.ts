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
    // The substitute is unpriced until the user enters its cost; the replaced part's price stays on the row as "was".
    if (typeof t.item.data.line === "number") data.wasLine = t.item.data.line;
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
  qty: z.number().int().min(1).max(100000).optional().describe("merge: the quantity of the part that remains"),
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
      "Return one row per proposal: action \"remove\" with the part's id, or \"merge\" with the part that remains (replaces), the parts that go away (mergeWith), the remaining part's new name and description, and its quantity (qty).",
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
    // Merging rows that are the same part keeps every piece unless the model says otherwise: the quantities add up.
    const qtyOf = (i: { data: Record<string, unknown> }) => (typeof i.data.qty === "number" && i.data.qty > 0 ? i.data.qty : 1);
    const sameTitle = others.every((o) => o!.title.trim().toLowerCase() === t.item!.title.trim().toLowerCase());
    const qty = row.qty ?? (sameTitle ? qtyOf(t.item) + others.reduce((a, o) => a + qtyOf(o!), 0) : undefined);
    const kept = {
      title: row.title ? clip(row.title) : t.item.title,
      body: row.spec?.trim() || t.item.body,
      data: { ...t.item.data, ...(qty !== undefined ? { qty } : {}) },
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
  layerHeight: z.number().min(0.05).max(0.6).optional().describe("the new layer height in millimetres, a setting the slicer reads"),
  infill: z.number().min(0).max(100).optional().describe("the new infill in percent, a setting the slicer reads"),
  supports: z.boolean().optional().describe("whether supports are needed after the change"),
  settings: z.string().max(400).optional().describe("any other change in words: walls, top layers"),
  orientation: z.string().max(400).optional(),
  split: z.string().max(1000).optional().describe("if the part should be split into pieces, how and where"),
  reason: z.string().min(1).max(1000).describe("why this prints faster and what it costs in strength or finish"),
  basedOn,
});

/** Jobs the slicer or a printer is working on: their settings are not changed under them. */
const BUSY = new Set(["slicing", "sent", "printing"]);

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
      "You propose changes to 3D print jobs that shorten print time: a taller layer (layerHeight, mm), lower infill (infill, percent), no supports through a better orientation, or splitting a part.",
      "Give layerHeight, infill and supports as numbers and true or false: those are the settings the slicer reads. Anything else (walls, top layers) goes in settings, in words.",
      "Keep what the requirements need: strength where the part is loaded, finish where it is seen.",
      "Do not state a print time: the job is sliced again to measure it. Say why it should be faster and what it costs.",
      "Return one row per job to change, with \"replaces\" set to its id. Return no rows if nothing should change.",
      RULES,
    ].join("\n"),
    user: [conceptHeader(ctx), block("Print jobs", ctx.rows["prototype/printing"]), block("Parts", ctx.rows["design/bom"]), block("Requirements", ctx.rows["design/requirements"])].join("\n\n"),
  }),
  schema: printRow,
  toDraft(row, ctx) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok || !t.item) return { ok: false, reason: t.ok ? "it does not name a print job" : t.reason };
    if (BUSY.has(t.item.status)) return { ok: false, reason: `"${t.item.title}" is ${t.item.status}; its settings are not changed while the slicer or a printer has it` };
    const data: Record<string, unknown> = { ...t.item.data };
    if (row.layerHeight !== undefined) data.layerHeight = row.layerHeight;
    if (row.infill !== undefined) data.infill = Math.round(row.infill);
    if (row.supports !== undefined) data.supports = row.supports;
    if (row.settings) data.settings = row.settings.trim();
    if (row.orientation) data.orientation = row.orientation.trim();
    if (row.split) data.split = row.split.trim();
    const changed = ["layerHeight", "infill", "supports", "settings", "orientation", "split"].some((k) => JSON.stringify(data[k]) !== JSON.stringify(t.item!.data[k]));
    if (!changed) return { ok: false, reason: `it changes nothing on "${t.item.title}"` };
    // The old time no longer applies: approving puts the job back to queued, not sliced, until it is sliced again
    // at the new settings. The before stays in the run's measurement; the after is the slicer's new figure.
    delete data.slice;
    data.estimate = "";
    delete data.printMinutes;
    return { ok: true, drafts: [{ title: t.item.title, body: t.item.body, data, op: { op: "replace", reason: row.reason.trim() }, itemId: t.item.id, basedOn: row.basedOn }] };
  },
};
