"use client";

import { readGeometry, type Geometry } from "@/lib/domain";
import { NOT_ADVICE } from "@/lib/compliance/text";
import { STAGES, storeKey, type Section } from "@/lib/menu";
import { CLAIM_BASIS_LABEL, SOURCE_KIND_LABEL, SOURCES_STORE, STORY_PARTS, STORY_STORE, type SourceData, type StoryClaim, type StoryExample } from "@/lib/story/parts";
import type { Item, Project } from "@/lib/types";
import { cellText, storeLabel } from "./format";
import type { ConceptData, ConceptPart } from "./useConcept";
import { fmtBytes, fmtDateTime, fmtMinutes } from "@/lib/format";
import { sentText } from "@/lib/channels/sentText";

/** One report, built once, rendered to the page and to Markdown from the same blocks. */
export type Block =
  | { t: "h2"; text: string; eyebrow?: string; id: string }
  | { t: "h3"; text: string; id: string }
  | { t: "p"; text: string; muted?: boolean }
  | { t: "table"; head: string[]; rows: string[][]; foot?: string[]; mono?: number[] }
  | { t: "links"; items: { text: string; href: string }[] }
  | { t: "quote"; label: string; text: string }
  /** Markdown written by a person (the concept story), rendered as Markdown */
  | { t: "md"; text: string }
  | { t: "empty" };

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/** "leadTimeDays" -> "lead time days", for a field name shown to a reader. */
const words = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();

/** A field's value in words: a list is counted, an object shows its plain values, never raw JSON. */
function readable(k: string, v: unknown, data: Record<string, unknown>): string {
  if (k === "sent") return sentText(data);
  if (Array.isArray(v)) {
    const plain = v.filter((x) => ["string", "number", "boolean"].includes(typeof x));
    return plain.length === v.length && v.length <= 6 ? plain.join(", ") : `${v.length} ${v.length === 1 ? "entry" : "entries"}`;
  }
  if (v && typeof v === "object") {
    const flat = Object.entries(v as Record<string, unknown>).filter(([, x]) => ["string", "number", "boolean"].includes(typeof x) && x !== "");
    return flat.length ? flat.slice(0, 4).map(([a, x]) => `${words(a)} ${String(x)}`).join(", ") : "";
  }
  return cellText(v);
}

/** Fields the report never shows: internal markers and the draft and step machinery. */
const HIDDEN = new Set(["_draft", "sending", "sendError", "sendUnknown", "key", "after", "minutes", "noProof", "checked", "geometry", "schematic", "symbolPos", "sourcing"]);

function extraFields(it: Item, skip: Set<string>) {
  return Object.entries(it.data)
    .filter(([k, v]) => !skip.has(k) && !HIDDEN.has(k) && !k.startsWith("_") && v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => [words(k), readable(k, v, it.data)] as const)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

function genericTable(section: Section, rows: Item[]): Block {
  const cols = section.columns ?? [];
  const skip = new Set(cols.map((c) => c.key));
  const extras = rows.map((r) => extraFields(r, skip));
  const withExtra = extras.some(Boolean);
  return {
    t: "table",
    head: ["Title", "Detail", ...cols.map((c) => c.label), ...(withExtra ? ["Other fields"] : []), "Status"],
    rows: rows.map((r, i) => [r.title, r.body, ...cols.map((c) => cellText(r.data[c.key])), ...(withExtra ? [extras[i]] : []), r.status]),
  };
}

function bomBlocks(rows: Item[]): Block[] {
  let total = 0;
  let missing = 0;
  const body = rows.map((r) => {
    const line = num(r.data.line);
    if (Number.isFinite(line)) total += line;
    else missing++;
    return [cellText(r.data.ref), r.title, cellText(r.data.qty), cellText(r.data.source), Number.isFinite(line) ? line.toFixed(2) : "", r.status];
  });
  const out: Block[] = [
    {
      t: "table",
      head: ["Ref", "Part", "Qty", "Source", "Line cost", "Status"],
      rows: body,
      foot: ["", "Total", "", "", total.toFixed(2), ""],
      mono: [0, 2, 4],
    },
  ];
  if (missing) out.push({ t: "p", text: `${missing} of ${rows.length} parts have no line cost, so the total leaves them out.`, muted: true });
  return out;
}

function complianceBlocks(rows: Item[]): Block[] {
  return [
    { t: "p", text: NOT_ADVICE },
    {
      t: "table",
      head: ["Topic", "Why it may apply", "What to check", "Evidence", "Status"],
      rows: rows.map((r) => [r.title, cellText(r.data.why), cellText(r.data.check), cellText(r.data.evidence), r.status === "draft" ? "draft, not confirmed" : r.status]),
    },
  ];
}

function sourcingBlocks(rows: Item[]): Block[] {
  return [
    {
      t: "table",
      head: ["Ref", "Part", "Source", "Search term", "ASIN", "Status"],
      rows: rows.map((r) => [cellText(r.data.ref), r.title, cellText(r.data.source), cellText(r.data.search), cellText(r.data.asin), r.status]),
      mono: [0, 4],
    },
  ];
}

function modelBlocks(bom: Item[], data: ConceptData): Block[] {
  const parts = bom.filter((r) => r.data.geometry && typeof r.data.geometry === "object");
  const stl = data.files.filter((f) => f.kind === "stl");
  const out: Block[] = [];
  if (parts.length) {
    out.push({
      t: "table",
      head: ["Ref", "Part", "Shape", "Size (mm)", "Position (mm)", "Basis", "Printed"],
      rows: parts.map((r) => {
        const g = readGeometry(r.data.geometry) ?? ({} as Partial<Geometry>);
        return [
          cellText(r.data.ref),
          g.count && g.count > 1 ? `${r.title} (x${g.count})` : r.title,
          g.shape ?? "",
          (g.size ?? []).join(" x "),
          (g.pos ?? []).join(", "),
          g.basis === "doc" ? "stated in source" : g.basis === "typical" ? "typical, not measured" : g.basis ?? "",
          g.print ? "yes" : "",
        ];
      }),
      mono: [0, 3, 4],
    });
  }
  if (stl.length) out.push({ t: "p", text: `STL files stored: ${stl.map((f) => f.name).join(", ")}.` });
  if (!out.length) out.push({ t: "empty" });
  return out;
}

/** The concept story as report blocks, part by part, then the list of its sources. */
function storyBlocks(story: Item[], sources: Item[]): Block[] {
  const out: Block[] = [{ t: "h2", text: "Concept story", id: "story" }];
  const titles = new Map(sources.map((s) => [s.id, s.title]));
  const cited = (ids: unknown) => (Array.isArray(ids) ? ids.map((n) => titles.get(n as number)).filter((t): t is string => !!t) : []);
  const byPart = new Map(story.map((i) => [String(i.data.part), i]));
  if (!story.length) out.push({ t: "p", text: "The concept story is not written yet.", muted: true });
  for (const p of STORY_PARTS) {
    const row = byPart.get(p.key);
    if (!row) continue;
    out.push({ t: "h3", text: p.heading, id: `story-${p.key}` });
    if (p.key === "positioning" && typeof row.data.position === "string" && row.data.position) out.push({ t: "quote", label: "The one-line position", text: row.data.position });
    if (row.body.trim()) out.push({ t: "md", text: row.body });
    const examples = (row.data.examples ?? []) as StoryExample[];
    if (examples.length) out.push({ t: "md", text: examples.map((e) => `- "${e.text}"${e.context ? ` (${e.context})` : ""}`).join("\n") });
    const claims = (row.data.claims ?? []) as StoryClaim[];
    if (claims.length) {
      out.push({ t: "table", head: ["How it is known", "Claim", "Note", "From"], rows: claims.map((c) => [CLAIM_BASIS_LABEL[c.basis] ?? c.basis, c.text, c.note ?? "", cited(c.sourceIds).join(", ")]) });
    }
    const from = cited(row.data.sourceIds);
    if (from.length) out.push({ t: "p", text: `Written from ${from.join(", ")}.`, muted: true });
  }
  out.push({ t: "h2", text: "Sources", id: "sources" });
  if (!sources.length) out.push({ t: "empty" });
  else {
    out.push({
      t: "table",
      head: ["Source", "What it is", "Kind", "Status", "Where it came from"],
      rows: sources.map((s) => {
        const d = s.data as SourceData;
        return [s.title, s.body, d.kind && d.kind in SOURCE_KIND_LABEL ? SOURCE_KIND_LABEL[d.kind] : "", s.status, String(d.origin ?? "")];
      }),
    });
  }
  return out;
}

export function buildReport(project: Project, data: ConceptData, errors: Partial<Record<ConceptPart, string>>): Block[] {
  const blocks: Block[] = [];
  const failed = Object.entries(errors);
  if (failed.length) {
    blocks.push({ t: "p", text: `Parts of this report could not be loaded: ${failed.map(([k, v]) => `${k} (${v})`).join("; ")}.` });
  }

  const byStore = new Map<string, Item[]>();
  for (const it of data.items) byStore.set(it.section, [...(byStore.get(it.section) ?? []), it]);
  const known = new Set<string>([STORY_STORE, SOURCES_STORE]);

  // The concept story comes first: it is the introduction to everything after it.
  blocks.push(...storyBlocks(byStore.get(STORY_STORE) ?? [], byStore.get(SOURCES_STORE) ?? []));

  for (const stage of STAGES) {
    blocks.push({ t: "h2", text: stage.label, eyebrow: `Stage ${stage.n}`, id: `stage-${stage.key}` });
    blocks.push({ t: "p", text: stage.goal, muted: true });
    for (const section of stage.sections) {
      // the story and the sources are at the top of the report
      if (section.href) continue;
      const store = storeKey(stage, section);
      known.add(store);
      const rows = byStore.get(store) ?? [];
      blocks.push({ t: "h3", text: section.label, id: `sec-${stage.key}-${section.key}` });

      if (section.view === "challenge") {
        if (errors.challenge) blocks.push({ t: "p", text: `Could not be loaded: ${errors.challenge}` });
        const msgs = data.challenge?.messages ?? [];
        if (msgs.length) msgs.forEach((m) => blocks.push({ t: "quote", label: `${m.role === "assistant" ? "Reviewer" : "You"} · ${fmtDateTime(m.createdAt)}`, text: m.content }));
        else if (!errors.challenge) blocks.push({ t: "empty" });
      } else if (section.view === "research") {
        if (errors.research) blocks.push({ t: "p", text: `Could not be loaded: ${errors.research}` });
        const entries = data.research?.entries ?? [];
        if (entries.length) {
          entries.forEach((e) => {
            blocks.push({ t: "quote", label: `${e.query} · ${e.model} · ${fmtDateTime(e.createdAt)}`, text: e.answer });
            if (e.citations.length) blocks.push({ t: "links", items: e.citations.map((c, i) => ({ text: `[${i + 1}] ${c}`, href: c })) });
          });
        } else if (!errors.research) blocks.push({ t: "empty" });
      } else if (section.view === "model") {
        blocks.push(...modelBlocks(byStore.get("design/bom") ?? [], data));
        if (rows.length) blocks.push(genericTable(section, rows));
      } else if (section.view === "results" || section.view === "links") {
        // kept in their own tables, not as rows: the figures are in the computed sections at the end
        blocks.push({ t: "p", text: section.view === "results" ? "Results are kept in their own table; the figures are under Campaign results, in Worked out from the rows, below." : "Tracked links are kept in their own table; they are listed under Tracked links, in Worked out from the rows, below.", muted: true });
        if (rows.length) blocks.push(genericTable(section, rows));
      } else if (!rows.length) {
        blocks.push({ t: "empty" });
      } else if (section.view === "bom") {
        blocks.push(...bomBlocks(rows));
      } else if (section.view === "sourcing") {
        blocks.push(...sourcingBlocks(rows));
      } else if (section.view === "compliance") {
        blocks.push(...complianceBlocks(rows));
      } else {
        blocks.push(genericTable(section, rows));
      }
    }
  }

  const other = data.items.filter((i) => !known.has(i.section));
  if (other.length) {
    blocks.push({ t: "h2", text: "Rows outside the menu", id: "other-rows" });
    blocks.push({
      t: "table",
      head: ["Section", "Title", "Detail", "Fields", "Status"],
      rows: other.map((r) => [r.section, r.title, r.body, extraFields(r, new Set()), r.status]),
      mono: [0],
    });
  }

  blocks.push({ t: "h2", text: "Order of operations", id: "plan" });
  const plan = data.plan;
  if (errors.plan) blocks.push({ t: "p", text: `Could not be loaded: ${errors.plan}` });
  if (plan) {
    blocks.push({ t: "p", text: plan.engine === "networkx" ? "Computed by NetworkX." : `No order: ${plan.note ?? "the planner service is not running."}`, muted: true });
    if (!plan.nodes.length) blocks.push({ t: "empty" });
    else {
      const idx = new Map(plan.order.map((id, i) => [id, i]));
      const nodes = [...plan.nodes].sort((a, b) => (idx.get(a.id) ?? 1e9) - (idx.get(b.id) ?? 1e9));
      blocks.push({
        t: "table",
        head: ["Wave", "Key", "Step", "Section", "Waits on", "Minutes", "Start", "Finish", "Critical", "Status"],
        rows: nodes.map((n) => [
          n.wave < 0 ? (plan.engine === "unavailable" ? "no order" : "blocked") : String(n.wave + 1),
          n.id,
          n.title,
          storeLabel(n.section),
          n.after.join(", "),
          String(n.minutes),
          String(n.start),
          String(n.finish),
          n.critical ? "yes" : "",
          n.status,
        ]),
        mono: [0, 1, 4, 5, 6, 7],
      });
      const byKey = new Map(plan.nodes.map((n) => [n.id, n]));
      blocks.push({ t: "p", text: `Total time ${fmtMinutes(plan.totalMinutes)} (${plan.totalMinutes} min).` });
      if (plan.criticalPath.length) blocks.push({ t: "p", text: `Critical path: ${plan.criticalPath.map((id) => byKey.get(id)?.title ?? id).join(" → ")}.` });
      plan.cycles.forEach((c) => blocks.push({ t: "p", text: `Blocking loop, no order exists for: ${c.map((id) => byKey.get(id)?.title ?? id).join(", ")}.` }));
    }
  }

  blocks.push({ t: "h2", text: "Files", id: "files" });
  if (errors.files) blocks.push({ t: "p", text: `Could not be loaded: ${errors.files}` });
  if (data.files.length) {
    blocks.push({
      t: "table",
      head: ["Name", "Kind", "Size", "SHA-256", "Stored"],
      rows: data.files.map((f) => [f.name, f.kind, `${fmtBytes(f.size)} (${f.size} bytes)`, f.sha256, fmtDateTime(f.createdAt)]),
      mono: [2, 3],
    });
  } else if (!errors.files) blocks.push({ t: "empty" });

  blocks.push({ t: "h2", text: "Activity log", id: "events" });
  if (errors.events) blocks.push({ t: "p", text: `Could not be loaded: ${errors.events}` });
  if (data.events.length) {
    blocks.push({ t: "table", head: ["When", "Kind", "What happened"], rows: data.events.map((e) => [fmtDateTime(e.createdAt), e.kind, e.summary]), mono: [0, 1] });
  } else if (!errors.events) blocks.push({ t: "empty" });

  return blocks;
}

const mdCell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>") || " ";

export function toMarkdown(project: Project, generatedAt: string, blocks: Block[]) {
  const out: string[] = [`# ${project.name}`, "", project.oneLiner, "", `Generated ${generatedAt}`, ""];
  for (const b of blocks) {
    switch (b.t) {
      case "h2":
        out.push(`## ${b.eyebrow ? `${b.eyebrow}. ` : ""}${b.text}`, "");
        break;
      case "h3":
        out.push(`### ${b.text}`, "");
        break;
      case "p":
        out.push(b.muted ? `_${b.text}_` : b.text, "");
        break;
      case "empty":
        out.push("Nothing recorded.", "");
        break;
      case "md":
        out.push(b.text, "");
        break;
      case "quote":
        out.push(`**${b.label}**`, "", ...b.text.split(/\r?\n/).map((l) => `> ${l}`), "");
        break;
      case "links":
        out.push(...b.items.map((l) => `- <${l.href}>`), "");
        break;
      case "table":
        out.push(`| ${b.head.map(mdCell).join(" | ")} |`, `| ${b.head.map(() => "---").join(" | ")} |`);
        b.rows.forEach((r) => out.push(`| ${r.map(mdCell).join(" | ")} |`));
        if (b.foot) out.push(`| ${b.foot.map((c) => (c ? `**${mdCell(c)}**` : " ")).join(" | ")} |`);
        out.push("");
        break;
    }
  }
  return out.join("\n");
}

