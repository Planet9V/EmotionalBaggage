// Wizard answers and the one function that turns them into items. Nothing is added that the
// person did not type, except open questions for decisions they left blank.

export type PartRow = { key: number; name: string; qty: string; source: string; search: string; line: string };
export type NameRow = { key: number; kind: "Name" | "Tagline"; text: string };

export type Answers = {
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

export const SOURCES = ["Amazon", "Micro Center", "Own printer", "Other"] as const;

let keySeed = 1;
export const nextKey = () => keySeed++;

export const emptyAnswers = (): Answers => ({
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

export const namedParts = (a: Answers) => a.parts.filter((p) => t(p.name));

export function envelope(a: Answers): [number, number, number] | null {
  const w = num(a.w), h = num(a.h), d = num(a.d);
  return w !== null && h !== null && d !== null && w > 0 && h > 0 && d > 0 ? [w, h, d] : null;
}

/** Problems that stop a step from moving on. Empty string means fine. */
export function stepError(a: Answers, step: number): string {
  if (step === 1) {
    if (!t(a.name)) return "Give the concept a name.";
    if (!t(a.oneLiner)) return "Add a one-line description.";
  }
  if (step === 3) {
    const given = [a.w, a.h, a.d].filter((x) => t(x));
    if (given.length > 0 && !envelope(a)) return "Give width, height and depth as positive numbers in mm, or clear all three.";
    for (const p of namedParts(a)) {
      const q = num(p.qty);
      if (q === null || q < 1 || !Number.isInteger(q)) return `Part "${t(p.name)}" needs a whole-number quantity.`;
      if (t(p.line) && (num(p.line) === null || (num(p.line) ?? 0) < 0)) return `Part "${t(p.name)}" has a cost that is not a number.`;
    }
  }
  if (step === 4 && t(a.testCost) && num(a.testCost) === null) return "The test cost must be a number.";
  if (step === 5 && t(a.price) && num(a.price) === null) return "The target price must be a number.";
  return "";
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
