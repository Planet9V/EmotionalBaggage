// The sections the printed report and the overview add from the twelve features (integration item 10):
// the unit economics, compliance, builds, the enclosure choice and its checks, the electrical checks,
// the launch plan's dates and the campaigns' verdicts. Each is worked out by the feature's own code and
// shown only where the concept holds the rows it is worked from. Tables and sentences, no headline tiles.
// Server only (the electrical checks read the pins table; the verdicts read the campaign results).
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import type { Item } from "@/lib/types";
import { channelResults, fixedCosts, referenceUnitCost } from "@/lib/economics/compute";
import { formatMoney } from "@/lib/economics/money";
import { readEconomics } from "@/lib/economics/read";
import { STORE_BATCHES, STORE_CHANNELS, STORE_COMPLIANCE, STORE_ECONOMICS, STORE_METHODS } from "@/lib/economics/schemas";
import { NOT_ADVICE } from "@/lib/compliance/text";
import { buildProgress } from "@/lib/trace/builds";
import { enclosureCheck, ENCLOSURE_STORE, type EnclosureChecked } from "@/lib/process/computed";
import { GENERATORS, type GeneratorKey } from "@/lib/enclosure/types";
import { ercForProject } from "@/lib/parts/server";
import { sectionVisible } from "@/lib/productTypes";
import { analyze } from "@/lib/campaigns/analyze";
import { campaignsOf, planOf } from "@/lib/campaigns/read";
import { channelMargins } from "@/lib/campaigns/margin";
import { LAUNCH_STORE } from "@/lib/campaigns/schemas";
import { loadLinkClicks, loadResults } from "@/lib/campaigns/server";
import { plural } from "@/lib/format";

type ReportBlock =
  | { t: "p"; text: string; muted?: boolean }
  | { t: "table"; head: string[]; rows: string[][]; foot?: string[]; mono?: number[] };

export type ReportSection = { id: string; title: string; href: string; blocks: ReportBlock[] };


function economics(by: (s: string) => Item[], currency: string): ReportSection | null {
  const rows = { parts: by("design/bom"), economics: by(STORE_ECONOMICS), channels: by(STORE_CHANNELS), methods: by(STORE_METHODS), batches: by(STORE_BATCHES) };
  if (!rows.economics.length && !rows.channels.length && !rows.batches.length) return null;
  const inputs = readEconomics(rows, currency);
  const u = referenceUnitCost(inputs);
  const fm = (m: number | null) => (m === null ? "not priced" : formatMoney(m, currency));
  const blocks: ReportBlock[] = [
    { t: "p", text: `Unit cost at ${plural(u.batchSize, "unit")} (the first planned batch, or 1): ${formatMoney(u.total, currency)}${u.complete ? "." : `, incomplete: ${plural(u.missing.length, "line")} not priced and left out (${u.missing.slice(0, 6).map((m) => m.what).join("; ")}).`}` },
    { t: "table", head: ["Line", "Amount", "How it is worked out"], rows: u.lines.map((l) => [l.label, fm(l.amount), l.how]), foot: ["Unit cost", formatMoney(u.total, currency), ""], mono: [1] },
  ];
  const ch = channelResults(inputs.channels, u, fixedCosts(inputs));
  if (ch.length) {
    blocks.push({
      t: "table",
      head: ["Channel", "Price", "Margin per unit", "Margin", "Break-even"],
      rows: ch.map((c) => [c.title, fm(c.price), fm(c.margin), c.marginPercent === null ? "" : `${c.marginPercent.toFixed(1)}%`, c.breakEven ? (c.breakEven.units === null ? c.breakEven.reason : `${c.breakEven.units} units`) : "no price"]),
      mono: [1, 2, 3],
    });
  }
  return { id: "computed-economics", title: "Unit economics", href: "/s/production/economics", blocks };
}

function compliance(by: (s: string) => Item[]): ReportSection | null {
  const all = by(STORE_COMPLIANCE);
  const confirmed = all.filter((r) => r.status !== "draft");
  if (!confirmed.length) return null;
  const count = (s: string) => confirmed.filter((r) => r.status === s).length;
  return {
    id: "computed-compliance",
    title: "Compliance",
    href: "/s/production/compliance",
    blocks: [
      { t: "p", text: NOT_ADVICE, muted: true },
      { t: "p", text: `${plural(confirmed.length, "confirmed row")}: ${count("to check")} to check, ${count("applies")} applies, ${count("does not apply")} does not apply, ${count("done")} done.${all.length > confirmed.length ? ` ${plural(all.length - confirmed.length, "draft")} not confirmed and left out.` : ""}` },
      { t: "table", head: ["Topic", "Status", "What to check"], rows: confirmed.map((r) => [r.title, r.status, String(r.data.check ?? "")]) },
    ],
  };
}

function builds(by: (s: string) => Item[]): ReportSection | null {
  const list = by("prototype/builds");
  if (!list.length) return null;
  const tests = by("prototype/tests");
  const jobs = by("prototype/printing");
  return {
    id: "computed-builds",
    title: "Builds",
    href: "/s/prototype/builds",
    blocks: [
      {
        t: "table",
        head: ["Build", "Status", "Exit criteria met", "Tests passed", "Print jobs", "What stops it passing"],
        rows: list.map((b) => {
          const p = buildProgress(b, tests);
          const key = typeof b.data.key === "string" ? b.data.key : "";
          const mine = key ? jobs.filter((j) => j.data.buildKey === key) : [];
          return [b.title, b.status, `${p.met} of ${p.criteria.length}`, `${p.testsDone} of ${p.linked.length}`, mine.length ? `${mine.length} (${mine.filter((j) => j.status === "done").length} done)` : "none", p.blockers.join("; ") || "nothing"];
        }),
      },
    ],
  };
}

function enclosure(items: Item[]): ReportSection | null {
  const saved = items.find((r) => r.section === ENCLOSURE_STORE);
  const d = (saved?.data ?? {}) as { enclosureGenerator?: GeneratorKey; params?: Record<string, unknown>; checked?: Record<string, EnclosureChecked> };
  if (!saved || !d.enclosureGenerator || !GENERATORS[d.enclosureGenerator]) return null;
  const gen = GENERATORS[d.enclosureGenerator];
  const state = enclosureCheck(items);
  const record = d.checked?.[d.enclosureGenerator];
  const p = d.params ?? {};
  const blocks: ReportBlock[] = [
    { t: "p", text: `Chosen generator: ${gen.label} (${gen.licence}). Lid: ${String(p.lidType ?? "default")}; wall ${String(p.wallThickness ?? "default")} mm; clearance ${String(p.clearance ?? "default")} mm.` },
    { t: "p", text: state.met ? `The checks pass on the saved choice: ${state.detail}` : `The checks do not count yet: ${state.detail} ${state.action}.` },
  ];
  if (record?.checks.length) blocks.push({ t: "table", head: ["Check", "Result", "Measured"], rows: record.checks.map((c) => [c.label, c.ok ? "pass" : "fail", c.detail ?? ""]) });
  return { id: "computed-enclosure", title: "Enclosure", href: "/s/design/enclosure", blocks };
}

async function electrical(projectId: string, productType: string, items: Item[]): Promise<ReportSection | null> {
  if (!sectionVisible(productType, "design", "schematic")) return null;
  if (!items.some((r) => r.section === "design/wiring")) return null;
  const e = await ercForProject(projectId);
  const shown = e.findings.filter((f) => f.severity !== "info").slice(0, 20);
  return {
    id: "computed-electrical",
    title: "Electrical checks",
    href: "/s/design/schematic",
    blocks: [
      { t: "p", text: e.ok ? `No errors. ${plural(e.warnings, "warning")} and ${plural(e.infos, "note")}.` : `${plural(e.errors, "error")}, ${plural(e.warnings, "warning")} and ${plural(e.infos, "note")}. The Design gate holds while an error stands.` },
      ...(shown.length ? [{ t: "table" as const, head: ["Severity", "Finding"], rows: shown.map((f) => [f.severity, f.text]) }] : []),
    ],
  };
}

function launchDates(by: (s: string) => Item[]): ReportSection | null {
  const rows = by(LAUNCH_STORE);
  const launches = rows.filter((r) => r.data.kind === "launch" && typeof r.data.launchDate === "string" && r.data.launchDate);
  if (!launches.length) return null;
  const dayOf = (iso: string, before: number) => {
    const t = new Date(`${iso}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - before);
    return t.toISOString().slice(0, 10);
  };
  const steps: string[][] = [];
  for (const l of launches) {
    const key = String(l.data.launchKey ?? "");
    for (const s of rows.filter((r) => r.data.kind === "step" && r.data.launch === key)) {
      const before = typeof s.data.daysBefore === "number" ? s.data.daysBefore : null;
      steps.push([l.title, before === null ? "no date" : dayOf(String(l.data.launchDate), before), s.title, s.status]);
    }
  }
  steps.sort((a, b) => a[1].localeCompare(b[1]));
  return {
    id: "computed-launch",
    title: "Launch plan dates",
    href: "/s/marketing/launch",
    blocks: [
      { t: "table", head: ["Launch", "Channel", "Launch day"], rows: launches.map((l) => [l.title, String(l.data.channel ?? ""), String(l.data.launchDate)]), mono: [2] },
      ...(steps.length ? [{ t: "table" as const, head: ["Launch", "Date", "Step", "Status"], rows: steps, mono: [1] }] : []),
    ],
  };
}

async function campaignVerdicts(projectId: string, items: Item[], currency: string, econRows: Parameters<typeof channelMargins>[0]): Promise<ReportSection | null> {
  const campaigns = campaignsOf(items);
  if (!campaigns.length) return null;
  const [rows, clicks] = await Promise.all([loadResults(projectId), loadLinkClicks(projectId)]);
  const withData = campaigns.filter((c) => rows.some((r) => r.campaignId === c.id) || clicks.some((l) => l.campaignId === c.id));
  if (!withData.length) return null;
  const plan = planOf(items);
  const margins = channelMargins(econRows, currency);
  const money = (m: number) => formatMoney(m, currency);
  return {
    id: "computed-campaigns",
    title: "Campaign verdicts",
    href: "/s/marketing/results",
    blocks: [
      { t: "p", text: "Each verdict is worked out in code from the results entered and the campaign's own stop and scale rule.", muted: true },
      {
        t: "table",
        head: ["Campaign", "Verdict", "Spent", "Orders", "Cost per order", "Why"],
        rows: withData.map((c) => {
          const margin = c.salesChannel ? margins.find((m) => m.channelId === c.salesChannel!.itemId)?.marginBeforeAds ?? null : null;
          const a = analyze({ campaign: c, rows, linkClicks: clicks, plan, unitMarginBeforeAds: margin, money });
          return [c.title, a.evaluation.verdict.replace(/_/g, " "), money(a.counts.spend), String(a.counts.orders), a.derived.cpo === null ? "no orders" : money(Math.round(a.derived.cpo)), a.evaluation.headline];
        }),
        mono: [2, 3, 4],
      },
    ],
  };
}

/** Every computed section that has rows to be worked from, in stage order. */
export async function reportSections(projectId: string): Promise<ReportSection[]> {
  const p = (await q<{ currency: string; product_type: string }>("SELECT currency, product_type FROM projects WHERE id=$1", [projectId]))[0];
  const currency = p?.currency || "USD";
  const items = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [projectId])).map(toItem);
  const by = (s: string) => items.filter((i) => i.section === s);
  const econRows = { parts: by("design/bom"), economics: by(STORE_ECONOMICS), channels: by(STORE_CHANNELS), methods: by(STORE_METHODS), batches: by(STORE_BATCHES) };
  const out = [
    enclosure(items),
    await electrical(projectId, p?.product_type ?? "electronics", items),
    builds(by),
    economics(by, currency),
    compliance(by),
    launchDates(by),
    await campaignVerdicts(projectId, items, currency, econRows),
  ];
  return out.filter((s): s is ReportSection => s !== null);
}
