// "Draft a campaign plan" for the drafting engine (src/lib/ai/drafts). The model chooses which
// campaigns to propose and why: the objective, the audience, the channel, the message and the
// creative to run. Every number on a draft is worked out here from the concept's own rows, and shown
// with its arithmetic on the draft:
//   allowable cost per order = margin per unit before ads (Unit economics) x the share the user set
//   budget                   = the marketing budget the user set x the share the model proposes
//   stop line / scale line   = the allowable cost per order, and a user-set share of it
// A number the model gives for any of these is not read at all: the schema has no field for it.
import { z } from "zod";
import { brandText, findKit } from "@/lib/market/brandKit";
import { formatMoney } from "@/lib/economics/money";
import type { Item } from "@/lib/types";
import type { GenContext, Generator } from "@/lib/ai/drafts/types";
import { RULES, basedOn, block, conceptHeader } from "@/lib/ai/drafts/prompt";
import { addDays, inclusiveDays, isDay } from "./days";
import { allowableCostPerOrder, channelMargins, type ChannelMargin } from "./margin";
import { planOf, type PlanSettings } from "./read";
import { CAMPAIGN_STORE, OBJECTIVES, type RowRef } from "./schemas";
import { isLaunchRow, toLaunch } from "./launch";

const row = z.object({
  title: z.string().min(1).max(200).describe("the campaign's name, a few words"),
  objective: z.enum(OBJECTIVES).describe("awareness, consideration, conversion or retention"),
  channelId: z.number().int().describe("the id of the sales channel row this campaign sends buyers to (the number after # in the Sales channels list)"),
  adChannel: z.string().max(120).describe("where the campaign runs, for example Amazon Sponsored Products or Meta feed"),
  personaId: z.number().int().describe("the id of the persona it speaks to"),
  message: z.string().max(600).describe("the positioning message it carries, copied from the list"),
  creativeIds: z.array(z.number().int()).max(20).default([]).describe("ids of ads or posts it runs, only from the lists given"),
  budgetSharePercent: z.number().min(0).max(100).describe("the share of the marketing budget this campaign gets"),
  startOffsetDays: z.number().int().min(-365).max(365).default(0).describe("the day it starts, in days after launch day (negative is before)"),
  durationDays: z.number().int().min(1).max(365).describe("how many days it runs"),
  reasoning: z.string().min(1).max(1500).describe("why this campaign, for this persona, on this channel, in two or three plain sentences"),
  basedOn,
});
type Row = z.infer<typeof row>;


function planProblem(plan: PlanSettings): string {
  if (plan.totalMinor === null) return "Enter the marketing budget first (Campaigns, Marketing budget).";
  if (plan.allowableSharePercent === null) return "Enter the share of the margin per order that advertising may spend (Campaigns, Marketing budget). It is the one number the targets are worked from.";
  return "";
}

const ref = (section: string, i: Item): RowRef => ({ section, itemId: i.id, ...(typeof i.data.key === "string" && i.data.key ? { key: i.data.key } : {}), title: i.title });

function messagesOf(positioning: Item[]) {
  const out: { rowId: number; text: string }[] = [];
  for (const p of positioning) {
    const list = Array.isArray(p.data.messages) ? (p.data.messages as { text?: unknown }[]) : [];
    for (const m of list) if (typeof m?.text === "string" && m.text.trim()) out.push({ rowId: p.id, text: m.text.trim() });
  }
  return out;
}

const marginsOf = (ctx: GenContext): ChannelMargin[] =>
  channelMargins(
    {
      parts: ctx.rows["design/bom"] ?? [],
      economics: ctx.rows["production/economics"] ?? [],
      channels: ctx.rows["sales/channels"] ?? [],
      methods: ctx.rows["production/methods"] ?? [],
      batches: ctx.rows["production/batches"] ?? [],
    },
    ctx.concept.currency ?? "USD"
  );

export const campaignPlan: Generator<Row> = {
  id: "campaigns",
  label: "Campaign plan",
  action: "Draft a campaign plan",
  from: [
    "marketing/positioning",
    "marketing/personas",
    "marketing/ads",
    "marketing/social",
    "marketing/launch",
    "sales/channels",
    "design/bom",
    "production/economics",
    "production/methods",
    "production/batches",
    "marketing/brand",
    "marketing/campaigns",
  ],
  to: CAMPAIGN_STORE,
  kind: "section",
  applies: () => true,
  revises: false,
  blocked(ctx) {
    const problem = planProblem(planOf(ctx.existing));
    if (problem) return problem;
    if (!messagesOf(ctx.rows["marketing/positioning"] ?? []).length) return "Positioning has no message yet. Draft the positioning first (Marketing, Positioning).";
    if (!(ctx.rows["marketing/personas"] ?? []).length) return "There is no persona to speak to. Draft or add one first (Marketing, Personas).";
    if (!(ctx.rows["sales/channels"] ?? []).length) return "There is no sales channel. Add one first (Sales, Channels and pricing): a campaign sends buyers somewhere.";
    return "";
  },
  buildPrompt(ctx) {
    const plan = planOf(ctx.existing);
    const cur = ctx.concept.currency ?? "USD";
    const margins = marginsOf(ctx);
    const msgs = messagesOf(ctx.rows["marketing/positioning"] ?? []);
    const channelLines = margins
      .map((m) => `#${m.channelId} ${m.title}: margin per unit before ads ${m.marginBeforeAds === null ? "cannot be worked out yet" : formatMoney(m.marginBeforeAds, cur)}`)
      .join("\n");
    const brand = brandText(findKit(ctx.rows["marketing/brand"] ?? []));
    return {
      system: [
        "You propose the advertising and promotion campaigns for a product, from its positioning, its audiences and what each sales channel earns.",
        "For each campaign choose: the objective, the sales channel it sends buyers to, where it runs, the persona it speaks to, one positioning message from the list (copied exactly), the ads and posts it runs, its share of the marketing budget, when it starts (days after launch day) and how long it runs.",
        "Do NOT give any budget amount, cost, target, margin or price: those are worked out by the program from the figures it holds. Give only the shares and days asked for.",
        "The shares of the budget across all your campaigns must not add up to more than 100.",
        "Propose between 2 and 5 campaigns that differ in audience, channel or objective. Do not repeat a campaign that already exists.",
        "Use only the personas, channels, messages, ads and posts listed. Do not invent a platform feature or rule.",
        RULES,
        brand ? `Brand voice for any wording:\n${brand}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      user: [
        conceptHeader(ctx),
        `Marketing budget: ${formatMoney(plan.totalMinor ?? 0, cur)} in all${plan.monthlyMinor !== null ? `, ${formatMoney(plan.monthlyMinor, cur)} a month` : ""}.`,
        block("Personas", ctx.rows["marketing/personas"], { skip: ["theirWords", "generatedFrom"] }),
        `Positioning messages (copy one exactly):\n${msgs.map((m) => `- (positioning row #${m.rowId}) ${m.text}`).join("\n")}`,
        `Sales channels and what each earns:\n${channelLines || "(none)"}`,
        block("Ads you may link", ctx.rows["marketing/ads"], { bodyMax: 300 }),
        block("Posts you may link", ctx.rows["marketing/social"], { bodyMax: 300 }),
        block("Campaigns already planned", ctx.existing.filter((i) => i.data?.kind !== "plan"), { bodyMax: 200 }),
      ].join("\n\n"),
    };
  },
  schema: row,
  toDraft(r, ctx, run) {
    const plan = planOf(ctx.existing);
    const cur = ctx.concept.currency ?? "USD";
    const money = (m: number) => formatMoney(m, cur);
    const personas = ctx.rows["marketing/personas"] ?? [];
    const persona = personas.find((p) => p.id === r.personaId);
    if (!persona) return { ok: false, reason: `it names persona #${r.personaId}, which is not in the concept` };
    const margins = marginsOf(ctx);
    const channelRow = (ctx.rows["sales/channels"] ?? []).find((c) => c.id === r.channelId);
    if (!channelRow) return { ok: false, reason: `it names sales channel #${r.channelId}, which is not in the concept` };
    const msgs = messagesOf(ctx.rows["marketing/positioning"] ?? []);
    const msg = msgs.find((m) => m.text.replace(/\s+/g, " ") === r.message.trim().replace(/\s+/g, " "));
    if (!msg) return { ok: false, reason: "its message is not one of the positioning messages" };

    // the budget shares of one run may not add up past 100
    const used = (run.memo.get("share") as number | undefined) ?? 0;
    if (used + r.budgetSharePercent > 100 + 1e-9) return { ok: false, reason: `the budget shares of the campaigns add to more than 100% (this one would bring them to ${used + r.budgetSharePercent}%)` };
    run.memo.set("share", used + r.budgetSharePercent);

    const notes: string[] = [];
    const arithmetic: { label: string; how: string }[] = [];
    const total = Math.floor(((plan.totalMinor ?? 0) * r.budgetSharePercent) / 100);
    arithmetic.push({ label: "Budget", how: `${r.budgetSharePercent}% of ${money(plan.totalMinor ?? 0)} = ${money(total)}` });

    const launch = (ctx.rows["marketing/launch"] ?? []).filter(isLaunchRow).map(toLaunch).filter((l) => isDay(l.launchDate)).sort((a, b) => (a.launchDate < b.launchDate ? -1 : 1))[0];
    let startDate = "";
    let endDate = "";
    if (launch) {
      startDate = addDays(launch.launchDate, r.startOffsetDays) ?? "";
      endDate = startDate ? (addDays(startDate, r.durationDays - 1) ?? "") : "";
      arithmetic.push({ label: "Dates", how: `Launch day ${launch.launchDate} (${launch.title}); starts ${r.startOffsetDays} days after it and runs ${r.durationDays} days: ${startDate} to ${endDate}` });
    } else notes.push(`"${r.title}": no launch date is set, so its dates were left empty. Set them, or add a launch plan first.`);
    const days = startDate && endDate ? inclusiveDays(startDate, endDate) : r.durationDays;
    const daily = days && days > 0 ? Math.floor(total / days) : 0;
    if (days) arithmetic.push({ label: "Daily budget", how: `${money(total)} / ${days} days = ${money(daily)}` });

    const margin = margins.find((m) => m.channelId === channelRow.id) ?? null;
    const allow = allowableCostPerOrder(margin?.marginBeforeAds ?? null, plan.allowableSharePercent);
    if (margin?.marginBeforeAds != null) arithmetic.push({ label: "Margin per unit before ads", how: `${money(margin.marginBeforeAds)} on ${margin.title}, from Unit economics (batch of ${margin.batchSize})` });
    let target: Record<string, unknown> | undefined;
    let rule: Record<string, unknown> | undefined;
    if (allow.minor === null) {
      notes.push(`"${r.title}": no target or rule was set because ${allow.how.charAt(0).toLowerCase()}${allow.how.slice(1)}${margin?.missing.length ? ` (${margin.missing[0]})` : ""}`);
    } else {
      arithmetic.push({ label: "Allowable cost per order", how: `${allow.how} = ${money(margin!.marginBeforeAds!)} x ${plan.allowableSharePercent}% = ${money(allow.minor)}` });
      if (r.objective === "conversion") {
        target = { metric: "cost_per_order", value: allow.minor };
        arithmetic.push({ label: "Orders the budget can buy", how: `${money(total)} / ${money(allow.minor)} = ${allow.minor > 0 ? Math.floor(total / allow.minor) : 0} orders at the ceiling` });
        const r2: Record<string, unknown> = { stopAboveMinor: allow.minor };
        if (plan.judgeAfterOrders !== null) {
          r2.afterSpendMinor = Math.round(allow.minor * plan.judgeAfterOrders);
          arithmetic.push({ label: "Judge after", how: `${plan.judgeAfterOrders} orders' worth of spend: ${plan.judgeAfterOrders} x ${money(allow.minor)} = ${money(r2.afterSpendMinor as number)}` });
        } else notes.push(`"${r.title}": the rule has no spend to wait for, because "judge after" is not set on the Campaigns page.`);
        if (plan.scaleBelowPercent !== null) {
          r2.scaleBelowMinor = Math.floor((allow.minor * plan.scaleBelowPercent) / 100);
          if (plan.scaleByPercent !== null) r2.scaleByPercent = plan.scaleByPercent;
          arithmetic.push({ label: "Scale line", how: `${plan.scaleBelowPercent}% of ${money(allow.minor)} = ${money(r2.scaleBelowMinor as number)}${plan.scaleByPercent !== null ? `; raise the daily budget by ${plan.scaleByPercent}%` : ""}` });
        }
        arithmetic.push({ label: "Stop line", how: `stop if cost per order is above ${money(allow.minor)}` });
        rule = r2;
      } else {
        notes.push(`"${r.title}": ${r.objective} has no order target, so none was set. Choose the measure you will judge it by.`);
      }
    }

    const creativeRefs: RowRef[] = [];
    const ads = ctx.rows["marketing/ads"] ?? [];
    const posts = ctx.rows["marketing/social"] ?? [];
    for (const id of r.creativeIds) {
      const a = ads.find((x) => x.id === id);
      const p = posts.find((x) => x.id === id);
      if (a) creativeRefs.push(ref("marketing/ads", a));
      else if (p) creativeRefs.push(ref("marketing/social", p));
      else notes.push(`"${r.title}": dropped creative #${id}, which is not an ad or post in the concept.`);
    }

    const data: Record<string, unknown> = {
      kind: "campaign",
      objective: r.objective,
      audience: ref("marketing/personas", persona),
      salesChannel: ref("sales/channels", channelRow),
      channel: r.adChannel.trim(),
      budgetTotalMinor: total,
      ...(daily > 0 ? { budgetDailyMinor: daily } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(creativeRefs.length ? { creative: creativeRefs } : {}),
      ...(target ? { target } : {}),
      ...(rule ? { rule } : {}),
      message: msg.text,
      reasoning: r.reasoning.trim(),
      arithmetic,
    };
    return {
      ok: true,
      notes,
      drafts: [{ title: r.title.trim(), body: r.reasoning.trim(), data, op: { op: "add" }, basedOn: [...(r.basedOn ?? []), persona.id, channelRow.id, msg.rowId] }],
    };
  },
};

