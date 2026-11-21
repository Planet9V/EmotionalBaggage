import { NextResponse } from "next/server";
import { z } from "zod";
import { completeJson, getReasoning, ModelError } from "@/lib/ai/models";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { body, requireProject, route } from "@/lib/api/route";
import { analyze } from "@/lib/campaigns/analyze";
import { channelMargins } from "@/lib/campaigns/margin";
import { planOf, toCampaign } from "@/lib/campaigns/read";
import { CAMPAIGN_STORE } from "@/lib/campaigns/schemas";
import { economicsRowsOf, loadLinkClicks, loadResults, requireCampaign } from "@/lib/campaigns/server";
import { currencyOf } from "@/lib/economics/currency";
import { formatMoney } from "@/lib/economics/money";

type Ctx = { params: Promise<{ id: string }> };

const answer = z.object({
  explanation: z.string().min(1).max(1200).describe("two or three plain sentences on what the numbers show, using only the figures given"),
  suggestion: z.string().min(1).max(800).describe("one next step to consider, in a sentence or two; it must not contradict the verdict"),
});

/**
 * A short explanation of a campaign's verdict, and a suggestion, written by the reasoning model. The
 * verdict itself is the rule's, worked out here in code from the saved results and returned with the
 * figures behind it; the model is told the verdict and cannot change it. The screen labels the text
 * as the model's. Nothing is saved.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, z.object({ campaignId: z.number().int().positive() }));
  const item = await requireCampaign(id, b.campaignId);
  const campaign = toCampaign(item);
  const currency = await currencyOf(id);
  const money = (m: number) => formatMoney(m, currency);
  const [rows, linkClicks, econ, all] = await Promise.all([
    loadResults(id, b.campaignId),
    loadLinkClicks(id, b.campaignId),
    economicsRowsOf(id),
    q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2`, [id, CAMPAIGN_STORE]),
  ]);
  const plan = planOf(all.map(toItem));
  const margin = campaign.salesChannel ? channelMargins(econ, currency).find((m) => m.channelId === campaign.salesChannel!.itemId)?.marginBeforeAds ?? null : null;
  const a = analyze({ campaign, rows, linkClicks, plan, unitMarginBeforeAds: margin, money });

  const verdict = { verdict: a.evaluation.verdict, headline: a.evaluation.headline, numbers: a.evaluation.numbers, warnings: a.evaluation.warnings, ruleSays: a.evaluation.ruleSays };
  const reasoning = await getReasoning();
  if (!reasoning.ok) throw new ModelError(503, reasoning.reason, "not-configured");

  const facts = [
    `Campaign: ${campaign.title}${campaign.channel ? ` on ${campaign.channel}` : ""}. Objective: ${campaign.objective || "not set"}.`,
    `Verdict (set by the rule, not by you): ${a.evaluation.verdict}. ${a.evaluation.headline}`,
    ...a.evaluation.numbers.map((n) => `${n.label}: ${n.value}`),
    a.target ? `Target: ${a.target.text}` : "No target is set.",
    `Days with results: ${a.days.length}. Clicks used: ${a.clicks.value} (${a.clicks.source}).`,
    a.marginAfter ? `Margin after ads: ${a.marginAfter.how}` : "Margin after ads cannot be worked out.",
    ...a.comparisons.slice(0, 6).map((c) => c.text),
    ...a.evaluation.warnings,
  ].join("\n");
  const res = await completeJson({
    use: reasoning,
    system: "You explain an advertising campaign's results to its owner. The verdict was already decided by a rule the owner set; you must not change it, soften it or argue with it. Use only the figures given: never add a figure, a benchmark or a claim about the platform. If the sample is small, say that plainly. Short plain sentences, no em dashes.",
    messages: [{ role: "user", content: facts }],
    schema: answer,
    maxOutputTokens: 700,
    temperature: 0.3,
    signal: req.signal,
  });
  return NextResponse.json({ ...verdict, modelText: res.object, model: res.info.model, label: "Written by the reasoning model. The verdict above is the rule's." });
});
