// What the story sections of the welcome page show, worked out on the server from the example's seeded rows
// (exampleData.ts) and the app's own rules, and handed to the page as plain values. Nothing here is typed in:
// every word and number is a seeded row, a rule the app enforces (a channel's limits, a listing's limits, a
// launch template's steps, the proof check, the contrast check) or a count of rows.
//   hero    the nine small artefacts of the hero's idea-in, outputs-out visual
//   chain   one seeded row per step of the drafting chain (brief, requirement, part, wire, assembly, test, ad)
//   market  the seven tabs of the market stage
import type { Item } from "@/lib/types";
import { toPart, partPrice, sumLine } from "@/lib/domain";
import { toWires } from "@/components/buildsheet/derive";
import { checkProof, type ProofRow, type ProofState } from "@/lib/market/proof";
import { positioningLine } from "@/lib/market/positioning";
import { findKit, readKit } from "@/lib/market/brandKit";
import { checkColour } from "@/lib/market/contrast";
import { AD_CHANNELS, LISTING_CATEGORIES, SOCIAL_CHANNELS, measure } from "@/lib/content/channels";
import { KIND_LABEL } from "@/lib/content/landing";
import { TEMPLATES } from "@/lib/campaigns/templates";
import { CHANNELS } from "@/lib/channels/registry";
import { isLaunchRow, isStepRow } from "@/lib/campaigns/launch";
import { STAGES } from "@/lib/menu";
import { SEED_STORY } from "@/lib/story/seed";
import type { ExampleData } from "./exampleData";
import { EXAMPLE } from "./content";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const money = (n: number | null) => (n === null ? "no price" : `$${n.toFixed(2)}`);
/** A seeded title with its dash set as a colon ("Phase 2 — Electronics" reads "Phase 2: Electronics"). */
const plain = (s: string) => s.replace(/\s+—\s+/g, ": ");
const row = (rows: Item[], title: string) => rows.find((r) => r.title === title) ?? rows[0];

export type HeroFacts = {
  brief: { title: string; body: string; lines: number };
  claim: { title: string; source: string; status: string; count: number };
  parts: { rows: { ref: string; title: string; line: string }[]; more: number; total: string };
  wires: number;
  case: { w: number; h: number; d: number } | null;
  print: { material: string; settings: string };
  cost: { rows: { title: string; volume: string; cogs: string }[]; status: string };
  ad: { text: string; status: string; count: number };
  channel: { title: string; price: string; net: string; status: string; listing: string };
};

export type ChainStep = { key: string; stage: string; kind: string; title: string; body: string };

export type MarketData = {
  positioning: {
    line: string;
    notes: { title: string; body: string; status: string }[];
    statements: number;
    /** what a proof link to the example's rows would count as today, by the app's own proof check */
    pool: { label: string; count: number; proven: number; state: ProofState }[];
  };
  brand: {
    kit: boolean;
    voice: { title: string; body: string; status: string } | null;
    /** the app's contrast check, run on this site's own orange because the example has chosen no colour */
    demo: { hex: string; white: string; whiteLevel: string; black: string; blackLevel: string; note: string } | null;
  };
  ads: {
    drafts: { text: string; channel: string; rule: string; status: string; body: string; length: number; xLength: number }[];
    channels: { id: string; label: string; summary: string; fields: { label: string; max: string; enforce: boolean; required: boolean }[]; unverified: string; textMax: number | null; textEnforce: boolean; textLabel: string; xWeight: boolean }[];
    social: { label: string; max: number; enforce: boolean }[];
    posts: number;
  };
  landing: { pages: { title: string; path: string; cta: string; body: string; status: string }[]; kinds: string[]; sections: number };
  launch: { templates: { id: string; label: string; blurb: string; steps: { title: string; phase: string; days: number; gate: string }[] }[]; launches: number; steps: number };
  listing: {
    rows: { title: string; body: string; status: string }[];
    category: string;
    note: string;
    fields: { key: string; label: string; max: number; unit: string; rows: number; enforce: boolean }[];
  };
  results: {
    channels: { title: string; price: string; take: string; net: string; status: string }[];
    campaigns: { title: string; funnel: string; budget: string; target: string; status: string }[];
    days: number;
    connections: { name: string; does: string }[];
  };
};

function hero(d: ExampleData): HeroFacts {
  const parts = d.parts.map(toPart);
  const one = row(d.brief, "One-liner");
  const claim = d.claims[0];
  const print = d.printing[d.printing.length - 1];
  const ad = d.ads[0];
  const channel = d.channels[0];
  return {
    brief: { title: one?.title ?? "", body: one?.body ?? "", lines: d.brief.length },
    claim: { title: claim?.title ?? "", source: str(claim?.data.source), status: claim?.status ?? "", count: d.claims.length },
    parts: { rows: parts.slice(0, 3).map((p) => ({ ref: p.ref, title: p.title, line: money(partPrice(p).line) })), more: Math.max(0, parts.length - 3), total: money(sumLine(parts)) },
    wires: d.wires.length,
    case: d.enclosure ? { w: d.enclosure.outer[0], h: d.enclosure.outer[1], d: d.enclosure.outer[2] } : null,
    print: { material: str(print?.data.material).split(",")[0] ?? "", settings: str(print?.data.settings).split(",").slice(0, 2).join(",") },
    cost: { rows: d.economics.filter((r) => /^\d/.test(str(r.data.volume))).slice(0, 3).map((r) => ({ title: r.title, volume: str(r.data.volume), cogs: str(r.data.cogs) })), status: d.economics[0]?.status ?? "" },
    ad: { text: ad?.title ?? "", status: ad?.status ?? "", count: d.ads.length },
    channel: { title: channel?.title ?? "", price: str(channel?.data.price), net: str(channel?.data.net), status: channel?.status ?? "", listing: d.listing[0]?.title ?? "" },
  };
}

function chain(d: ExampleData): ChainStep[] {
  const brief = row(d.brief, "How it works");
  const req = row(d.requirements, "Controls");
  const part = d.parts.map(toPart).find((p) => p.ref === "S2");
  const wire = toWires(d.wires).find((w) => w.from === "S2" || w.to === "S2");
  const step = d.assembly.find((r) => str(r.data.key) === "p2") ?? d.assembly[0];
  const test = row(d.tests, "Carry");
  const ad = d.ads[0];
  return [
    { key: "brief", stage: "01 Concept", kind: "Brief line", title: brief?.title ?? "", body: brief?.body ?? "" },
    { key: "requirement", stage: "03 Design", kind: "Requirement", title: req?.title ?? "", body: req?.body ?? "" },
    { key: "part", stage: "03 Design", kind: "Part", title: part ? `${part.ref} ${part.title}` : "", body: part ? `${part.spec}. ${money(partPrice(part).line)}.` : "" },
    { key: "wire", stage: "03 Design", kind: "Wire", title: wire?.name ?? "", body: wire ? `${wire.from}.${wire.fromPin} to ${wire.to}.${wire.toPin}, net ${wire.net}.` : "" },
    { key: "assembly", stage: "04 Prototype", kind: "Assembly step", title: plain(step?.title ?? ""), body: step?.body ?? "" },
    { key: "test", stage: "04 Prototype", kind: "Acceptance test", title: test?.title ?? "", body: str(test?.data.pass) },
    { key: "ad", stage: "06 Marketing", kind: "Ad", title: ad?.title ?? "", body: str(ad?.data.channel) ? `${str(ad?.data.channel)}. ${str(ad?.data.rule)}.` : "" },
  ];
}

const CAPABILITY: Record<string, string> = { send: "post and reply", inbox: "read mentions and comments", import: "import performance reports", sales: "read orders" };

function market(d: ExampleData): MarketData {
  // positioning: the proof check, as the Positioning page runs it, on the rows a message could link to today
  const proofRows = new Map<number, ProofRow>([...d.claims, ...d.tests, ...d.requirements].map((i) => [i.id, { id: i.id, section: i.section, title: i.title, status: i.status, data: i.data }]));
  const stateOf = (rows: Item[]): ProofState => {
    const first = rows[0];
    if (!first) return "missing";
    return checkProof([{ text: "", proof: [{ itemId: first.id, section: first.section }] }], proofRows)[0]!.links[0]!.state;
  };
  const statements = d.positioning.filter((r) => r.data.kind === "statement");
  const notes = d.positioning.filter((r) => r.data.kind !== "statement");
  const voice = notes.find((r) => r.title === "Voice rules") ?? null;
  const kit = readKit(findKit(d.brand));
  const orange = checkColour("#E05A10");
  const textField = (c: (typeof AD_CHANNELS)[number]) => c.fields.find((f) => f.kind === "text" && f.max !== undefined && /text|headline|caption|line|title/i.test(f.label)) ?? null;
  const category = LISTING_CATEGORIES[0]!;
  const L = category.limits;
  const n = (v: number) => v.toLocaleString("en-US");
  return {
    positioning: {
      line: positioningLine({}, EXAMPLE.name),
      notes: notes.map((r) => ({ title: r.title, body: r.body, status: r.status })),
      statements: statements.length,
      pool: [
        { label: "Claims", count: d.claims.length, proven: d.claims.filter((r) => r.status === "verified").length, state: stateOf(d.claims) },
        { label: "Acceptance tests", count: d.tests.length, proven: d.tests.filter((r) => r.status === "pass").length, state: stateOf(d.tests) },
        { label: "Requirements", count: d.requirements.length, proven: 0, state: stateOf(d.requirements) },
      ],
    },
    brand: {
      kit: kit !== null,
      voice: voice ? { title: voice.title, body: voice.body, status: voice.status } : null,
      demo: orange ? { hex: orange.hex, white: orange.onWhite.ratio.toFixed(2), whiteLevel: orange.onWhite.level, black: orange.onBlack.ratio.toFixed(2), blackLevel: orange.onBlack.level, note: orange.warning ?? orange.note ?? "" } : null,
    },
    ads: {
      drafts: d.ads.map((r) => ({ text: r.title, channel: str(r.data.channel), rule: str(r.data.rule), status: r.status, body: r.body, length: measure(r.title), xLength: measure(r.title, true) })),
      channels: AD_CHANNELS.map((c) => {
        const t = textField(c);
        return {
          id: c.id,
          label: c.label,
          summary: c.summary,
          fields: c.fields.map((f) => ({
            label: f.label,
            max: f.kind === "choice" ? `one of ${f.choices?.length ?? 0}` : f.kind === "list" ? [f.maxItems ? `up to ${f.maxItems}` : "", f.max ? `${f.max} characters each` : "", f.maxWords ? `${f.maxWords} words each` : ""].filter(Boolean).join(", ") : f.max ? `${n(f.max)} characters` : "a web address",
            enforce: f.enforce,
            required: !!f.required,
          })),
          unverified: c.unverified,
          textMax: t?.max ?? null,
          textEnforce: !!t?.enforce,
          textLabel: t?.label ?? "",
          xWeight: !!t?.xWeight,
        };
      }),
      social: SOCIAL_CHANNELS.map((c) => ({ label: c.label, max: c.max, enforce: c.enforce })),
      posts: d.social.length,
    },
    landing: {
      pages: d.landing.map((r) => ({ title: r.title, path: str(r.data.path), cta: str(r.data.cta), body: r.body, status: r.status })),
      kinds: Object.values(KIND_LABEL),
      sections: d.landing.filter((r) => typeof r.data.kind === "string" && r.data.kind in KIND_LABEL).length,
    },
    launch: {
      templates: TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        blurb: t.blurb,
        steps: [...t.steps].sort((a, b) => b.daysBefore - a.daysBefore).map((s) => ({ title: s.title, phase: s.phase, days: s.daysBefore, gate: s.requires?.[0]?.stage ?? "" })),
      })),
      launches: d.launch.filter(isLaunchRow).length,
      steps: d.launch.filter(isStepRow).length,
    },
    listing: {
      rows: d.listing.map((r) => ({ title: r.title, body: r.body, status: r.status })),
      category: category.label,
      note: category.note,
      fields: [
        { key: "title", label: "Title", max: L.title.max, unit: "characters", rows: 1, enforce: L.title.enforce },
        { key: "bullets", label: "Bullets", max: L.bullets.max, unit: "characters each", rows: L.bullets.count, enforce: L.bullets.enforce },
        { key: "description", label: "Description", max: L.description.max, unit: "characters", rows: 1, enforce: L.description.enforce },
        { key: "search", label: "Search terms", max: L.searchTerms.maxBytes, unit: "bytes", rows: 1, enforce: L.searchTerms.enforce },
      ],
    },
    results: {
      channels: d.channels.map((r) => ({ title: r.title, price: str(r.data.price), take: str(r.data.take), net: str(r.data.net), status: r.status })),
      campaigns: d.campaigns.map((r) => ({ title: r.title.replace(/^\d+ · /, ""), funnel: str(r.data.funnel), budget: str(r.data.budget) === "—" ? "none set" : str(r.data.budget), target: str(r.data.kpi), status: r.status })),
      days: 0,
      connections: CHANNELS.filter((c) => ["amazon", "x", "instagram"].includes(c.id)).map((c) => ({ name: c.name, does: c.supports.map((s) => CAPABILITY[s]).filter(Boolean).join(", ") })),
    },
  };
}

/**
 * The origin of the example, in the story's own words (the origin part of src/lib/story/seed.ts): its first two
 * sentences, exactly as written there, and the idea as the owner's first note put it, which is the two phrases
 * the second sentence quotes from that note.
 */
function origin(): { sentences: string[]; idea: string } {
  const body = SEED_STORY.find((p) => p.part === "origin")?.body ?? "";
  const sentences = (body.split("\n")[0] ?? "").split(/(?<=[.?!]"?)\s+(?=[A-Z])/).slice(0, 2);
  const quoted = Array.from((sentences[1] ?? "").matchAll(/"([^"]+)"/g), (m) => m[1]!);
  return { sentences, idea: quoted.join(": ") };
}

/** What each stage holds in the workbench: its sections, by the names the menu gives them (src/lib/menu.ts). */
const holds = (): Record<string, string[]> => Object.fromEntries(STAGES.map((s) => [String(s.n).padStart(2, "0"), [...new Set(s.sections.map((x) => x.label))]]));

export type StoryData = { hero: HeroFacts; chain: ChainStep[]; market: MarketData; origin: { sentences: string[]; idea: string }; holds: Record<string, string[]> };

export function storyData(d: ExampleData): StoryData {
  return { hero: hero(d), chain: chain(d), market: market(d), origin: origin(), holds: holds() };
}
