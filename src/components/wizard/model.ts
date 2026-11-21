// Wizard answers, the zod schema of each step (what keeps a step from moving on) and the one function that
// turns the answers into items. Nothing is added that the person did not type, except open questions for
// decisions they left blank.
import { z } from "zod";
import { DEFAULT_PRODUCT_TYPE, PRODUCT_TYPE_KEYS, type ProductType } from "@/lib/productTypes";

type PartRow = { key: number; name: string; qty: string; source: string; search: string; line: string };
type NameRow = { key: number; kind: "Name" | "Tagline"; text: string };

export type Answers = {
  productType: ProductType;
  name: string;
  oneLiner: string;
  who: string;
  problem: string;
  why: string;
  how: string;
  printed: "" | "yes" | "no";
  w: string;
  h: string;
  d: string;
  parts: PartRow[];
  test: string;
  testCost: string;
  gate: string;
  channel: string;
  price: string;
  names: NameRow[];
};


let keySeed = 1;
export const nextKey = () => keySeed++;

export const emptyAnswers = (): Answers => ({
  productType: DEFAULT_PRODUCT_TYPE,
  name: "", oneLiner: "", who: "", problem: "", why: "", how: "",
  printed: "", w: "", h: "", d: "",
  parts: [{ key: nextKey(), name: "", qty: "", source: "", search: "", line: "" }],
  test: "", testCost: "", gate: "",
  channel: "", price: "",
  names: [{ key: nextKey(), kind: "Name", text: "" }],
});

export type NewItem = { section: string; title: string; body?: string; data?: Record<string, unknown>; status?: string };

export type Group = { label: string; step: number; section: string; items: NewItem[] };

const t = (s: string) => s.trim();
const num = (s: string) => {
  const n = Number(t(s));
  return t(s) !== "" && Number.isFinite(n) ? n : null;
};

const namedParts = (a: Answers) => a.parts.filter((p) => t(p.name));

function envelope(a: Answers): [number, number, number] | null {
  const w = num(a.w), h = num(a.h), d = num(a.d);
  return w !== null && h !== null && d !== null && w > 0 && h > 0 && d > 0 ? [w, h, d] : null;
}

const text = z.string();

/** The schema of each step, by step id. A step moves on only when its schema accepts its fields; the messages are shown as written. */
export const STEP_SCHEMAS = {
  idea: z.object({
    productType: z.enum(PRODUCT_TYPE_KEYS),
    name: text.refine((v) => v.trim() !== "", "Give the concept a name."),
    oneLiner: text.refine((v) => v.trim() !== "", "Add a one-line description."),
  }),
  who: z.object({ who: text, problem: text, why: text }),
  product: z
    .object({
      how: text,
      printed: z.enum(["", "yes", "no"]),
      w: text,
      h: text,
      d: text,
      parts: z.array(z.object({ key: z.number(), name: text, qty: text, source: text, search: text, line: text })),
    })
    .superRefine((v, ctx) => {
      const given = [v.w, v.h, v.d].filter((x) => t(x));
      const sizes = [num(v.w), num(v.h), num(v.d)];
      if (given.length > 0 && !(sizes.every((n) => n !== null && n > 0) && given.length === 3)) {
        ctx.addIssue({ code: "custom", path: ["w"], message: "Give width, height and depth as positive numbers in mm, or clear all three." });
      }
      v.parts.forEach((p, i) => {
        if (!t(p.name)) return;
        const q = num(p.qty);
        if (q === null || q < 1 || !Number.isInteger(q)) ctx.addIssue({ code: "custom", path: ["parts", i, "qty"], message: `Part "${t(p.name)}" needs a whole-number quantity.` });
        if (t(p.line) && (num(p.line) === null || (num(p.line) ?? 0) < 0)) ctx.addIssue({ code: "custom", path: ["parts", i, "line"], message: `Part "${t(p.name)}" has a cost that is not a number.` });
      });
    }),
  proof: z.object({
    test: text,
    testCost: text.refine((v) => !t(v) || num(v) !== null, "The test cost must be a number."),
    gate: text,
  }),
  selling: z.object({
    channel: text,
    price: text.refine((v) => !t(v) || num(v) !== null, "The target price must be a number."),
    names: z.array(z.object({ key: z.number(), kind: z.enum(["Name", "Tagline"]), text })),
  }),
  review: z.object({}),
} as const;

export type StepId = keyof typeof STEP_SCHEMAS;

/** The answers checked against every step but the review; the first problem found, with the step it belongs to. */
export function firstProblem(a: Answers): { step: StepId; message: string } | null {
  for (const id of Object.keys(STEP_SCHEMAS) as StepId[]) {
    const r = STEP_SCHEMAS[id].safeParse(a);
    if (!r.success) return { step: id, message: r.error.issues[0]!.message };
  }
  return null;
}

export function buildGroups(a: Answers): Group[] {
  const groups: Group[] = [];
  const brief: NewItem[] = [];
  const brow = (title: string, body: string) => t(body) && brief.push({ section: "concept/brief", title, body: t(body), status: "open" });
  brow("One-liner", a.oneLiner);
  brow("Who it is for", a.who);
  brow("Problem", a.problem);
  brow("Why now", a.why);
  brow("How it works", a.how);
  const proof: string[] = [];
  if (t(a.test)) proof.push(`Test: ${t(a.test)}`);
  if (t(a.testCost)) proof.push(`Cost: ${t(a.testCost)}`);
  if (t(a.gate)) proof.push(`Go/no-go gate: ${t(a.gate)}`);
  brow("The test and the gate", proof.join("\n"));
  if (brief.length) groups.push({ label: "Concept · Brief", step: 1, section: "concept/brief", items: brief });

  const names: NewItem[] = a.names
    .filter((n) => t(n.text))
    .map((n) => ({ section: "concept/names", title: t(n.text), data: { kind: n.kind }, status: "candidate" }));
  if (names.length) groups.push({ label: "Concept · Names and taglines", step: 5, section: "concept/names", items: names });

  const parts: NewItem[] = [];
  let ref = 0;
  for (const p of namedParts(a)) {
    ref += 1;
    const own = p.source === "Own printer";
    const data: Record<string, unknown> = { ref: `P${ref}`, qty: num(p.qty) ?? 1, source: p.source, search: t(p.search), asin: "" };
    const line = num(p.line);
    if (line !== null) data.line = line;
    parts.push({ section: "design/bom", title: t(p.name), data, status: own ? "to print" : "to buy" });
  }
  const env = envelope(a);
  if (a.printed === "yes" && env) {
    ref += 1;
    const [w, h, d] = env;
    parts.push({
      section: "design/bom",
      title: "Enclosure",
      data: {
        ref: `P${ref}`, qty: 1, source: "Own printer", search: "", asin: "",
        geometry: { shape: "shell", size: [w, h, d], pos: [0, h / 2, 0], explode: [0, 0, 0], basis: "doc", print: true },
      },
      status: "to print",
    });
  }
  if (parts.length) groups.push({ label: "Design · Bill of materials", step: 3, section: "design/bom", items: parts });

  if (t(a.channel)) {
    const price = num(a.price);
    groups.push({
      label: "Sales · Channels and pricing",
      step: 5,
      section: "sales/channels",
      items: [{ section: "sales/channels", title: t(a.channel), data: price !== null ? { price } : {}, status: "planned" }],
    });
  }

  const q: NewItem[] = [];
  const ask = (blank: boolean, title: string) => blank && q.push({ section: "concept/questions", title, status: "open" });
  ask(!t(a.who), "Who is it for?");
  ask(!t(a.problem), "What problem does it solve?");
  ask(!t(a.test), "What is the cheapest test that would show it is worth building?");
  ask(!t(a.gate), "What is the go/no-go gate?");
  ask(!!t(a.channel) && !t(a.price), "What is the target price?");
  if (q.length) groups.push({ label: "Concept · Open questions (left blank)", step: 2, section: "concept/questions", items: q });
  return groups;
}

export const buildItems = (a: Answers): NewItem[] => buildGroups(a).flatMap((g) => g.items);
