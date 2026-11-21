// Brief to requirements (4.3), requirements to a candidate parts list (4.4), parts to wiring (4.5).
import { z } from "zod";
import { PART_KIND_IDS, PIN_KIND_LABEL, PIN_KINDS } from "@/lib/parts/kinds";
import { sectionVisible } from "@/lib/productTypes";
import { partsByRef, readWires } from "@/lib/domain";
import { partPins, pinsByItem, type PinRow } from "@/lib/parts/pins";
import type { Item } from "@/lib/types";
import type { Generator } from "../types";
import { RULES, basedOn, block, clip, conceptHeader, critiqueBlock, nextKey, replaces, reviseBlock, revisionTarget } from "../prompt";

const always = () => true;
/** Wiring exists for product types that show the schematic. */
const hasElectronics = (productType: string) => sectionVisible(productType, "design", "schematic");

// ---------------------------------------------------------------------------------------------
// Requirements

const reqRow = z.object({
  title: z.string().min(1).max(300).describe("what the product must do, in a few words"),
  detail: z.string().max(4000).describe("the requirement in full, with how it will be tested"),
  trigger: z.string().max(400).optional().describe("what sets it off or what it responds to, if it has one"),
  response: z.string().max(400).optional().describe("what the product does then, if it applies"),
  basedOn,
  replaces,
});

export const requirements: Generator<z.infer<typeof reqRow>> = {
  id: "requirements",
  label: "Requirements",
  action: "Draft requirements",
  from: ["concept/brief", "concept/press", "concept/faq", "concept/decisions", "research/claims", "design/requirements"],
  to: "design/requirements",
  kind: "section",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["concept/brief"]?.length || ctx.concept.oneLiner ? "" : "Write at least one brief line or a one-liner for the concept first."),
  buildPrompt: (ctx) => ({
    system: [
      "You turn a product brief into requirements an engineer can design and test against.",
      "Each requirement is one testable statement: what the product must do or be, with a measurable limit where the record gives one, and how it will be checked.",
      "Cover function, power or energy where it applies, size and weight, use and handling, safety, and what the user controls. Leave out anything the record does not support.",
      "Do not repeat a requirement that already exists. Between 5 and 15 rows.",
      RULES,
    ].join("\n"),
    user: [
      conceptHeader(ctx),
      block("Brief", ctx.rows["concept/brief"]),
      block("Press release", ctx.rows["concept/press"], { bodyMax: 3000 }),
      block("FAQ", ctx.rows["concept/faq"]),
      block("Decisions", ctx.rows["concept/decisions"]),
      block("Claims", ctx.rows["research/claims"]),
      ctx.revise ? "" : block("Requirements already on record", ctx.rows["design/requirements"]),
      reviseBlock(ctx),
      critiqueBlock(ctx),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
  schema: reqRow,
  toDraft(row, ctx, run) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    const title = clip(row.title);
    if (!t.item && ctx.existing.some((i) => i.title.trim().toLowerCase() === title.toLowerCase())) {
      return { ok: false, reason: "a requirement with this title already exists" };
    }
    // A requirement is addressed by its key: acceptance tests and parts name the keys they serve.
    const key = t.item && typeof t.item.data.key === "string" && t.item.data.key ? t.item.data.key : nextKey("req-", run.keys);
    const data: Record<string, unknown> = { ...(t.item?.data ?? {}), key };
    if (row.trigger) data.trigger = row.trigger.trim();
    if (row.response) data.response = row.response.trim();
    return {
      ok: true,
      drafts: [{ title, body: row.detail.trim(), data, op: t.item ? { op: "replace" } : { op: "add" }, itemId: t.item?.id, basedOn: row.basedOn }],
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Parts

/** Pin kinds from docs/design/wiring.md, written the way a model is asked for them: the labels of PIN_KINDS in lower case ("power in"). */
export const PIN_ROLES = PIN_KINDS.map((k) => PIN_KIND_LABEL[k].toLowerCase()) as [string, ...string[]];

const partRow = z.object({
  ref: z.string().min(1).max(40).describe("reference designator, e.g. U1, R2, SW1, ENC1, HW1"),
  title: z.string().min(1).max(300),
  spec: z.string().max(2000).describe("what the part is and the properties that matter (no price)"),
  kind: z.enum(PART_KIND_IDS),
  qty: z.number().positive().max(100_000),
  pins: z
    .array(z.object({ name: z.string().min(1).max(60), role: z.enum(PIN_ROLES) }))
    .max(200)
    .optional()
    .describe("electrical parts only: every pin by its printed name, with its role"),
  size: z
    .object({ x: z.number().positive().max(5000), y: z.number().positive().max(5000), z: z.number().positive().max(5000) })
    .optional()
    .describe("typical outside size in millimetres: width x, height y, depth z"),
  search: z.string().max(400).optional().describe("words to search a supplier with"),
  requirements: z.array(z.string().max(120)).max(50).optional().describe("keys of the requirements this part serves"),
  basedOn,
  replaces,
});

export const parts: Generator<z.infer<typeof partRow>> = {
  id: "parts",
  label: "Parts list",
  action: "Draft a parts list",
  from: ["concept/brief", "design/requirements", "concept/decisions", "design/bom"],
  to: "design/bom",
  kind: "section",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["design/requirements"]?.length ? "" : "Write or draft requirements first: parts are chosen to meet them."),
  buildPrompt: (ctx) => {
    const electronics = hasElectronics(ctx.concept.productType);
    return {
      system: [
        "You propose a candidate parts list that would meet the requirements. It is a starting point for an engineer, not a purchase order.",
        `Each part has a reference designator unique in the list, a kind (one of: ${PART_KIND_IDS.join(", ")}), a quantity, a typical size in millimetres, and the keys of the requirements it serves.`,
        electronics
          ? `For every electrical part list its pins by the names printed on a typical part, each with a role (one of: ${PIN_ROLES.join(", ")}). A resistor or capacitor has two passive pins named 1 and 2.`
          : "This product has no electronics: give no pins, and choose mechanical, printed and fastener kinds.",
        "Never give a price or a cost; leave cost out entirely. Say \"typical\" sizes, not a specific supplier's.",
        "Do not reuse a reference that is already in the parts list. Between 3 and 30 rows.",
        RULES,
      ].join("\n"),
      user: [
        conceptHeader(ctx),
        block("Brief", ctx.rows["concept/brief"]),
        block("Requirements (key= is what you list in requirements)", ctx.rows["design/requirements"]),
        block("Decisions", ctx.rows["concept/decisions"]),
        ctx.revise ? "" : block("Parts already in the list", ctx.rows["design/bom"]),
        reviseBlock(ctx),
        critiqueBlock(ctx),
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  },
  schema: partRow,
  toDraft(row, ctx, run) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    const ref = row.ref.trim();
    const ownRef = t.item && typeof t.item.data.ref === "string" ? t.item.data.ref : "";
    if (ref !== ownRef && run.refs.has(ref)) return { ok: false, reason: `reference ${ref} is already used` };
    run.refs.add(ref);
    const notes: string[] = [];
    const reqKeys = new Set((ctx.rows["design/requirements"] ?? []).map((i) => i.data.key).filter((k): k is string => typeof k === "string" && k !== ""));
    const named = (row.requirements ?? []).map((k) => k.trim()).filter(Boolean);
    const known = named.filter((k) => reqKeys.has(k));
    if (known.length < named.length) notes.push(`${ref}: requirement keys that do not exist were left out (${named.filter((k) => !reqKeys.has(k)).join(", ")}).`);
    const electronics = hasElectronics(ctx.concept.productType);
    const pins = electronics ? [...new Map((row.pins ?? []).map((p) => [p.name.trim(), p.role])).entries()].filter(([n]) => n) : [];
    if (!electronics && row.pins?.length) notes.push(`${ref}: pins were left out because this product type has no electronics.`);
    const data: Record<string, unknown> = {
      ...(t.item?.data ?? {}),
      ref,
      qty: row.qty,
      kind: row.kind,
      ...(row.search ? { search: row.search.trim() } : {}),
      ...(known.length ? { requirements: known } : {}),
    };
    if (pins.length) {
      data.pins = pins.map(([n]) => n);
      data.pinRoles = Object.fromEntries(pins);
    }
    if (row.size) data.geometry = { shape: "box", size: [row.size.x, row.size.y, row.size.z], basis: "typical" };
    // Never a price: cost is the user's to enter.
    if (!t.item) delete data.line;
    return {
      ok: true,
      notes,
      drafts: [{ title: clip(row.title), body: row.spec.trim(), data, op: t.item ? { op: "replace" } : { op: "add" }, itemId: t.item?.id, basedOn: row.basedOn }],
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Wiring

const NET_CLASS = ["power", "ground", "signal", "audio"] as const;

const wireRow = z.object({
  title: z.string().min(1).max(300).describe("what the wire does, e.g. Sensor power"),
  from: z.string().min(3).max(120).describe("start as ref.pin, e.g. U1.3V3"),
  to: z.string().min(3).max(120).describe("end as ref.pin, e.g. U2.VCC"),
  net: z.string().max(120).optional(),
  netClass: z.enum(NET_CLASS),
  note: z.string().max(1000).optional().describe("what to check after soldering it"),
  basedOn,
  replaces,
});

/** "U1.GPIO8" to ["U1", "GPIO8"]. The pin is everything after the first dot, so "U1.5V/VIN" works. */
function splitEnd(end: string): [string, string] | null {
  const s = end.trim();
  const dot = s.indexOf(".");
  if (dot <= 0 || dot === s.length - 1) return null;
  return [s.slice(0, dot).trim(), s.slice(dot + 1).trim()];
}

/**
 * Every part with a reference, and its pins as the schematic resolves them (U17): its own pin rows, its library
 * entry, its kind's default pins, then the names its wires already use (partPins); a part's legacy data.pins last.
 */
export function resolvedPins(bom: Item[], wiring: Item[], pinRows: PinRow[]): { ref: string; title: string; item: Item; pins: string[] }[] {
  const own = pinsByItem(pinRows);
  const wires = readWires(wiring);
  return [...partsByRef(bom).values()].map((p) => {
    const named = wires.flatMap((w) => [w.from === p.ref ? w.fromPin : "", w.to === p.ref ? w.toPin : ""]).filter(Boolean);
    const resolved = partPins(p.item, own.get(p.item.id) ?? [], named).pins.map((x) => x.name);
    return { ref: p.ref, title: p.title, item: p.item, pins: resolved.length ? resolved : p.pins };
  });
}

/** The sentence that blocks drafting wires: only when no part has a pin, naming the parts that lack them. */
export function wiringBlocked(bom: Item[], wiring: Item[], pinRows: PinRow[]): string {
  const all = resolvedPins(bom, wiring, pinRows);
  if (!all.length) return "The parts list has no part with a reference such as U1. Add the parts first.";
  if (all.some((p) => p.pins.length)) return "";
  const names = all.slice(0, 6).map((p) => `${p.ref} ${p.title}`).join(", ");
  return `No part has pins yet: ${names}${all.length > 6 ? ` and ${all.length - 6} more` : ""}. Choose each part's kind or library entry in the parts list, or enter its pins.`;
}

/** Parts with pins, as "U1 (module): VCC power in, GND ground, ...". */
function pinTable(bom: Item[], wiring: Item[], pinRows: PinRow[]) {
  const lines = resolvedPins(bom, wiring, pinRows)
    .filter((p) => p.pins.length)
    .map((p) => {
      const roles = (p.item.data.pinRoles ?? {}) as Record<string, string>;
      return `${p.ref} #${p.item.id} ${p.title}: ${p.pins.map((n) => (roles[n] ? `${n} (${roles[n]})` : n)).join(", ")}`;
    });
  return lines.length ? `Parts and their pins (wire only these ref.pin endpoints):\n${lines.join("\n")}` : "Parts and their pins: none have pins on record.";
}

const pinRowsOf = (ctx: { extra?: Record<string, unknown> }) => (Array.isArray(ctx.extra?.pins) ? (ctx.extra!.pins as PinRow[]) : []);

export const wiring: Generator<z.infer<typeof wireRow>> = {
  id: "wiring",
  label: "Wiring",
  action: "Draft the wiring",
  from: ["design/bom", "design/requirements", "design/wiring"],
  to: "design/wiring",
  kind: "section",
  applies: hasElectronics,
  revises: true,
  // The pin rows are read on the server; the schematic resolves pins the same way (src/lib/parts/pins.ts).
  load: async (concept) => ({ pins: await (await import("@/lib/parts/server")).pinsOfProject(concept.id) }),
  blocked: (ctx) => wiringBlocked(ctx.rows["design/bom"] ?? [], ctx.rows["design/wiring"] ?? [], pinRowsOf(ctx)),
  buildPrompt: (ctx) => ({
    system: [
      "You propose the wires of a first prototype: which pin connects to which.",
      "Every wire joins two endpoints written as ref.pin, using only the references and pin names listed. A wire to a pin that is not listed will be thrown away.",
      "Power and ground first, then signals. Give each a net name and a net class (power, ground, signal or audio).",
      "Where a part needs a series resistor or a pull-up that is not in the parts list, say so in the note of the wire instead of inventing a part.",
      ctx.revise ? "" : "Do not repeat a wire that already exists.",
      RULES,
    ]
      .filter(Boolean)
      .join("\n"),
    user: [
      conceptHeader(ctx),
      pinTable(ctx.rows["design/bom"] ?? [], ctx.rows["design/wiring"] ?? [], pinRowsOf(ctx)),
      block("Requirements", ctx.rows["design/requirements"]),
      ctx.revise ? "" : block("Wires already on record", ctx.rows["design/wiring"]),
      reviseBlock(ctx),
      critiqueBlock(ctx),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
  schema: wireRow,
  toDraft(row, ctx, run) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    const byRef = new Map(resolvedPins(ctx.rows["design/bom"] ?? [], ctx.rows["design/wiring"] ?? [], pinRowsOf(ctx)).map((p) => [p.ref, p]));
    const ends: [string, string][] = [];
    for (const raw of [row.from, row.to]) {
      const e = splitEnd(raw);
      if (!e) return { ok: false, reason: `"${raw}" is not written as ref.pin` };
      const part = byRef.get(e[0]);
      if (!part) return { ok: false, reason: `there is no part ${e[0]}` };
      if (!part.pins.includes(e[1])) return { ok: false, reason: `part ${e[0]} has no pin ${e[1]}` };
      ends.push(e);
    }
    if (ends[0][0] === ends[1][0] && ends[0][1] === ends[1][1]) return { ok: false, reason: "both ends are the same pin" };
    const pairKey = (a: [string, string], b: [string, string]) => [a.join("."), b.join(".")].sort().join("~");
    const pair = pairKey(ends[0], ends[1]);
    const seen = (run.memo.get("pairs") as Set<string> | undefined) ?? new Set(readWires(ctx.existing).filter((w) => w.item.id !== t.item?.id).map((w) => pairKey([w.from, w.fromPin], [w.to, w.toPin])));
    run.memo.set("pairs", seen);
    if (seen.has(pair)) return { ok: false, reason: "that wire already exists" };
    seen.add(pair);
    let order = run.memo.get("order") as number | undefined;
    if (order === undefined) order = Math.max(0, ...readWires(ctx.existing).map((w) => w.order));
    const own = t.item ? Number(t.item.data.order) || undefined : undefined;
    if (own === undefined) run.memo.set("order", ++order);
    const data: Record<string, unknown> = {
      ...(t.item?.data ?? {}),
      order: own ?? order,
      net: row.net?.trim() || "",
      netClass: row.netClass,
      from: ends[0][0],
      fromPin: ends[0][1],
      to: ends[1][0],
      toPin: ends[1][1],
    };
    return {
      ok: true,
      drafts: [{ title: clip(row.title), body: row.note?.trim() ?? "", data, op: t.item ? { op: "replace" } : { op: "add" }, itemId: t.item?.id, basedOn: row.basedOn }],
    };
  },
};

