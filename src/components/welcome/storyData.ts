// What the story sections of the welcome page show, worked out on the server from the example's seeded rows
// (exampleData.ts) and the app's own rules, and handed to the page as plain values. Nothing here is typed in:
// every word and number is a seeded row, a rule the app enforces (a channel's limits, a listing's limits, a
// launch template's steps, the proof check, the contrast check) or a count of rows.
//   hero    the four outputs the hero shows beside the product
//   market  the seven tabs of the market stage
import type { Item } from "@/lib/types";
import { toPart } from "@/lib/domain";
import { hubRef, sequence, toWires } from "@/components/buildsheet/derive";
import { assemblySteps, layerHeightOf, layerOf, type Phase, type SolderStep } from "@/components/three/showcaseLogic";
import type { PartGeometry } from "@/components/three/layout";
import { stillOf, type Still } from "./get/projection";
import { shellOutlineFor } from "./get/tagShell";
import { productOf, type Product } from "./product/model";
import { printedOf, type Printed } from "./product/printed";
import { netWheel, type Wheel } from "./get/heroArt";
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

export type HeroFacts = {
  wires: number;
  cost: { rows: { title: string; volume: string; cogs: string }[]; status: string };
  ad: { text: string; status: string; count: number };
  channel: { title: string; price: string; net: string; status: string };
  /** the netlist as a wheel, drawn from the real wires (get/heroArt.ts) */
  wheel: Wheel;
};

/** What "What you get" shows of each stage's output, beyond the market's rows: all from the seeded rows. */
export type GetData = {
  brief: { title: string; body: string; status: string }[];
  decisions: number;
  claims: { title: string; source: string; where: string; status: string }[];
  /** the assembly phases (prototype/assembly rows with a key) and the build sheet's soldering order */
  phases: Phase[];
  solder: SolderStep[];
  print: { title: string; status: string; material: string; settings: string; estimate: string }[];
  /** the layer height the main print job names, in mm */
  layerMm: number | null;
  volumes: { title: string; volume: string; cogs: string; status: string }[];
  /** the model as a vector drawing, from the parts' geometry rows (get/projection.ts) */
  still: Still;
  /** how many steps the assembly takes, in the build sheet's order (showcaseLogic.ts assemblySteps) */
  steps: number;
};

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
  const ad = d.ads[0];
  const channel = d.channels[0];
  const ws = toWires(d.wires);
  return {
    wires: d.wires.length,
    cost: { rows: d.economics.filter((r) => /^\d/.test(str(r.data.volume))).slice(0, 3).map((r) => ({ title: r.title, volume: str(r.data.volume), cogs: str(r.data.cogs) })), status: d.economics[0]?.status ?? "" },
    ad: { text: ad?.title ?? "", status: ad?.status ?? "", count: d.ads.length },
    channel: { title: channel?.title ?? "", price: str(channel?.data.price), net: str(channel?.data.net), status: channel?.status ?? "" },
    wheel: netWheel(ws, hubRef(ws)),
  };
}

function get(d: ExampleData): GetData {
  const parts = d.parts.map(toPart);
  const phases = d.assembly.filter((r) => /^p\d+$/.test(str(r.data.key))).map((r) => ({ key: str(r.data.key), title: r.title }));
  const solder = sequence(toWires(d.wires)).map((s) => ({ name: s.wire.name, from: s.wire.from, fromPin: s.wire.fromPin, to: s.wire.to, toPin: s.wire.toPin }));
  const kind = (p: (typeof parts)[number]) => str(p.item.data.kind);
  const shaped = parts.filter((p) => p.geometry);
  const steps = assemblySteps(
    shaped.map((p) => ({ id: p.item.id, ref: p.ref, title: p.title, layer: layerOf(kind(p), p.ref, p.title), board: kind(p) === "circuit board", shell: p.geometry!.shape === "shell" })),
    solder,
    phases,
  );
  const stepOf = (id: number) => Math.max(0, steps.findIndex((s) => s.ids.includes(id)));
  const main = d.printing[d.printing.length - 1];
  return {
    brief: d.brief.map((r) => ({ title: r.title, body: r.body, status: r.status })),
    decisions: d.decisions.length,
    claims: d.claims.map((r) => ({ title: r.title, source: str(r.data.source), where: str(r.data.sourceLocation), status: r.status })),
    phases,
    solder,
    print: d.printing.map((r) => ({ title: r.title, status: r.status, material: str(r.data.material), settings: str(r.data.settings), estimate: str(r.data.estimate) })),
    layerMm: layerHeightOf(str(main?.data.settings)),
    volumes: d.economics.filter((r) => /^\d/.test(str(r.data.volume))).map((r) => ({ title: r.title, volume: str(r.data.volume), cogs: str(r.data.cogs), status: r.status })),
    steps: steps.length,
    still: stillOf(shaped.map((p) => ({ id: p.item.id, ref: p.ref, title: p.title, kind: kind(p), geometry: p.geometry as PartGeometry, step: stepOf(p.item.id) })), 6, (size) => shellOutlineFor(size, true)),
  };
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

export type StoryData = { product: Product; printed: Printed | null; hero: HeroFacts; market: MarketData; origin: { sentences: string[]; idea: string }; holds: Record<string, string[]>; get: GetData };

export function storyData(d: ExampleData): StoryData {
  const g = get(d);
  const product = productOf(d.parts, d.wires);
  return { product, printed: printedOf(d.enclosureRow, product, d.printing), hero: hero(d), market: market(d), origin: origin(), holds: holds(), get: g };
}
