// What the campaign sections store in Item.data. Registered in src/lib/domain/schemas.ts (BY_STORE) so
// the API validates every write with these shapes. Loose, like every other section: a column a schema
// does not name is kept, and every field is optional, so a row typed by hand, an older row and a
// drafted row all pass.
import { z } from "zod";
import { DAY_RE } from "./days";

/** A host as a tracked link's allow-list keeps it: lower case, no scheme, port or path. */
export const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

export const CAMPAIGN_STORE = "marketing/campaigns";
export const LAUNCH_STORE = "marketing/launch";
/** Sections that only show tables of results and links; no item is ever written to these stores. */
export const RESULTS_STORE = "marketing/results";
export const LINKS_STORE = "marketing/links";

export const CAMPAIGN_STATUSES = ["planned", "ready", "running", "paused", "done", "killed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const OBJECTIVES = ["awareness", "consideration", "conversion", "retention"] as const;
export type Objective = (typeof OBJECTIVES)[number];
export const OBJECTIVE_LABEL: Record<Objective, string> = {
  awareness: "Awareness",
  consideration: "Consideration",
  conversion: "Conversion",
  retention: "Retention",
};

/**
 * The measure of success. Money metrics are minor units; ctr and cvr are fractions (0.02 is 2%).
 * Direction is part of the metric: cost per order and cost per click must come in at or below the
 * target, the rest at or above it.
 */
export const TARGET_METRICS = ["cost_per_order", "orders", "roas", "revenue", "cost_per_click", "ctr", "cvr", "clicks"] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

export const TARGET_INFO: Record<TargetMetric, { label: string; direction: "at_most" | "at_least"; kind: "money" | "count" | "ratio" | "fraction" }> = {
  cost_per_order: { label: "Cost per order", direction: "at_most", kind: "money" },
  orders: { label: "Orders or sign-ups", direction: "at_least", kind: "count" },
  roas: { label: "Return on ad spend", direction: "at_least", kind: "ratio" },
  revenue: { label: "Revenue", direction: "at_least", kind: "money" },
  cost_per_click: { label: "Cost per click", direction: "at_most", kind: "money" },
  ctr: { label: "Click-through rate", direction: "at_least", kind: "fraction" },
  cvr: { label: "Conversion rate", direction: "at_least", kind: "fraction" },
  clicks: { label: "Clicks", direction: "at_least", kind: "count" },
};

const text = (max = 2000) => z.string().max(max);
const minor = z.number().int().min(0).max(1_000_000_000_000);
const day = z.union([z.literal(""), z.string().regex(DAY_RE, "must be a date like 2026-12-31")]);

/** A row of another section, linked by its id (and its key when it has one, so a copy of the concept can find it again). */
export const rowRef = z.object({ section: text(60), itemId: z.number().int().positive(), key: text(120).optional(), title: text(300).optional() });
export type RowRef = z.infer<typeof rowRef>;

export const target = z.object({ metric: z.enum(TARGET_METRICS), value: z.number().finite().min(0) });
export type Target = z.infer<typeof target>;

/**
 * The rule for stopping or scaling, as numbers:
 *  - stop if the cost per order is above `stopAboveMinor` once `afterSpendMinor` has been spent;
 *  - scale the daily budget by `scaleByPercent` if the cost per order is below `scaleBelowMinor`
 *    once `afterSpendMinor` has been spent.
 * Any part may be left out; a rule with neither threshold judges nothing.
 */
export const stopScaleRule = z.object({
  stopAboveMinor: minor.optional(),
  afterSpendMinor: minor.optional(),
  scaleBelowMinor: minor.optional(),
  scaleByPercent: z.number().min(0).max(1000).optional(),
});
export type StopScaleRule = z.infer<typeof stopScaleRule>;

export const arithmeticLine = z.object({ label: text(200), how: text(600) });

export const campaignData = z.looseObject({
  /** "plan" is the one concept-level row holding the marketing budget and the settings below */
  kind: z.enum(["campaign", "plan"]).optional(),
  objective: z.enum(OBJECTIVES).nullable().optional(),
  /** the persona the campaign speaks to */
  audience: rowRef.nullable().optional(),
  /** the sales channel row (sales/channels) whose margin the allowable cost is worked from */
  salesChannel: rowRef.nullable().optional(),
  /** where it runs, in words: "Amazon Sponsored Products", "Meta feed" */
  channel: text(120).optional(),
  budgetTotalMinor: minor.nullable().optional(),
  budgetDailyMinor: minor.nullable().optional(),
  startDate: day.optional(),
  endDate: day.optional(),
  /** ads and posts the campaign runs */
  creative: z.array(rowRef).max(60).optional(),
  target: target.nullable().optional(),
  rule: stopScaleRule.optional(),
  /** the positioning message it carries, when drafted from one */
  message: text(600).optional(),
  /** why the draft proposes it, and the arithmetic behind its numbers */
  reasoning: text(4000).optional(),
  arithmetic: z.array(z.object({ label: text(200), how: text(600) })).max(20).optional(),
  generatedFrom: z.object({ sources: z.array(z.object({ kind: text(40), id: z.number().int().optional(), title: text(300) })).max(80), model: text(200), at: text(40) }).optional(),

  // kind "plan" only
  /** the concept's marketing budget: in all, and per month */
  planTotalMinor: minor.nullable().optional(),
  planMonthlyMinor: minor.nullable().optional(),
  /** share of the margin per order before ads that a campaign may spend to win one order (0 to 100) */
  allowableSharePercent: z.number().min(0).max(100).nullable().optional(),
  /** a rule is judged only after the spend reaches this many times the allowable cost per order */
  judgeAfterOrders: z.number().min(1).max(1000).nullable().optional(),
  /** the rule scales when cost per order falls below this share of the allowable cost (1 to 100), by this much */
  scaleBelowPercent: z.number().min(1).max(100).nullable().optional(),
  scaleByPercent: z.number().min(0).max(1000).nullable().optional(),
  /** below this many clicks AND this many orders a result is called too small to judge */
  minClicks: z.number().int().min(0).max(10_000_000).optional(),
  minOrders: z.number().int().min(0).max(10_000_000).optional(),
  /** the hosts a tracked link may send a visitor to: the landing page's host, the sales channels */
  linkHosts: z.array(z.string().regex(HOST_RE, "must be a host name such as shop.example")).max(50).optional(),
});
export type CampaignData = z.infer<typeof campaignData>;

// Launch plan -------------------------------------------------------------------------------------

/** What a step cannot be done before: a stage's gate being passed, or a named build passing. */
export const stepRequirement = z.object({
  kind: z.enum(["gate", "build"]),
  /** gate: the stage key ("prototype"). build: the build row's id as text. */
  ref: text(120),
  /** build: the build's name, so the notice reads without a lookup */
  label: text(300).optional(),
});
export type StepRequirement = z.infer<typeof stepRequirement>;

const step = {
  key: text(120).optional(),
  after: z.preprocess((v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v), z.array(text(120)).max(500)).optional(),
  minutes: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v), z.number().finite().min(0)).optional(),
};

export const launchData = z.looseObject({
  ...step,
  /** "launch" is one dated launch of one channel; "step" is one of its steps */
  kind: z.enum(["launch", "step"]).optional(),
  // launch rows
  launchKey: text(80).optional(),
  template: text(60).optional(),
  channel: text(120).optional(),
  launchDate: day.optional(),
  // step rows
  /** the launchKey of the launch this step belongs to */
  launch: text(80).optional(),
  /** days before launch day; negative is after */
  daysBefore: z.number().int().min(-3650).max(3650).optional(),
  phase: text(120).optional(),
  why: text(1000).optional(),
  how: text(2000).optional(),
  owner: text(120).optional(),
  requires: z.array(stepRequirement).max(10).optional(),
  /** the platform's own page the step's rule statement rests on */
  source: text(500).optional(),
  /** the step states a platform rule that was not sourced: the screen shows it as something to check */
  check: z.boolean().optional(),
  templateStep: text(80).optional(),
});
export type LaunchData = z.infer<typeof launchData>;

export const CAMPAIGN_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  [CAMPAIGN_STORE]: campaignData,
  [LAUNCH_STORE]: launchData,
};

/** The column mapping remembered for one channel's report file. */
export const savedMapping = z.object({
  layout: z.string().max(40).optional(),
  dateOrder: z.enum(["mdy", "dmy"]).default("mdy"),
  mapping: z.partialRecord(z.enum(["day", "campaign", "creative", "spend", "impressions", "clicks", "orders", "revenue"]), z.string().max(200)),
});
export type SavedMapping = z.infer<typeof savedMapping>;
