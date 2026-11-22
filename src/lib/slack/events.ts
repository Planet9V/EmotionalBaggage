// The Slack event catalogue: every event of sections 2 and 3 of docs/design/slack.md, with its audience, its default,
// the facts its message needs (a zod schema: ids and plain values, never a secret, a password, a sign-in link or a
// file's contents) and the buttons it offers. Pure; no network, no database.
import { z } from "zod";
import { ACCESS_LEVELS } from "@/lib/accessRequests/shared";
import { findSection } from "@/lib/menu";
import { conceptIdSchema, itemIdSchema, requestIdSchema, userIdSchema, type ActionKey } from "./actions";

export type SlackAudience = "platform" | "workspace" | "person";

/** The facts about a plain row in a concept: which concept, and the name the message shows for it. */
const concept = { conceptId: conceptIdSchema, conceptName: z.string() };
const text = z.string();
const count = z.number().int().nonnegative();
const money = { currency: z.string().regex(/^[A-Z]{3}$/) };
const day = z.iso.date();
const roleName = z.enum(["owner", "admin", "member"]);

type EventDef<S extends z.ZodType> = {
  /** stable key, stored in settings and in sent messages */
  key: string;
  audience: SlackAudience;
  title: string;
  description: string;
  /** on until someone switches it off; the optional digests are off */
  defaultOn: boolean;
  payload: S;
  /** the buttons, in order, by action key */
  actions: readonly ActionKey[];
};

const def = <S extends z.ZodType>(e: EventDef<S>) => e;

/** Every event, by key. The order is the order of the specification. */
export const EVENTS = {
  // --- section 2: the platform channel ---------------------------------------------------------------------------
  "platform.access_request.received": def({
    key: "platform.access_request.received",
    audience: "platform",
    title: "Access request received",
    description: "Someone asked for access on the welcome page.",
    defaultOn: true,
    payload: z.object({ requestId: requestIdSchema, name: text, email: text, level: z.enum(["", ...ACCESS_LEVELS]), message: text }),
    actions: ["platform.access_request.approve", "platform.access_request.decline", "platform.open"],
  }),
  "platform.signup.waiting": def({
    key: "platform.signup.waiting",
    audience: "platform",
    title: "Sign-up waiting for confirmation",
    description: "A sign-up cannot be confirmed by email because no mail server is set, so an administrator confirms it.",
    defaultOn: true,
    payload: z.object({ userId: userIdSchema, email: text, minutesAgo: count }),
    actions: ["platform.signup.confirm", "platform.signup.disable", "platform.open"],
  }),
  "platform.signup.confirmed": def({
    key: "platform.signup.confirmed",
    audience: "platform",
    title: "Sign-up confirmed",
    description: "A person confirmed their address and got their first workspace.",
    defaultOn: true,
    payload: z.object({ email: text, workspaceName: text }),
    actions: ["platform.open"],
  }),
  "platform.workspace.changed": def({
    key: "platform.workspace.changed",
    audience: "platform",
    title: "Workspace created or deleted",
    description: "A workspace was created or deleted.",
    defaultOn: true,
    payload: z.object({ change: z.enum(["created", "deleted"]), name: text, by: text, plan: text.optional() }),
    actions: ["platform.open"],
  }),
  "platform.plan.changed": def({
    key: "platform.plan.changed",
    audience: "platform",
    title: "Plan changed",
    description: "A workspace moved to another plan.",
    defaultOn: true,
    payload: z.object({ name: text, from: text, to: text, interval: z.enum(["monthly", "yearly"]).optional() }),
    actions: ["platform.open"],
  }),
  "platform.payment.failed": def({
    key: "platform.payment.failed",
    audience: "platform",
    title: "Payment failed",
    description: "A subscription payment was refused.",
    defaultOn: true,
    payload: z.object({
      name: text,
      reason: text,
      amountMinor: z.number().int(),
      ...money,
      retryOn: day.optional(),
      /** Stripe's customer id ("cus_..."), used only to build the link; not a secret */
      stripeCustomerId: z.string().regex(/^cus_[A-Za-z0-9]{1,64}$/).optional(),
    }),
    actions: ["platform.open_stripe", "platform.open"],
  }),
  "platform.subscription.cancelled": def({
    key: "platform.subscription.cancelled",
    audience: "platform",
    title: "Subscription cancelled",
    description: "A workspace cancelled its plan; access runs to the end of the paid period.",
    defaultOn: true,
    payload: z.object({ name: text, plan: text, endsOn: day }),
    actions: ["platform.open"],
  }),
  "platform.ai_credits.low": def({
    key: "platform.ai_credits.low",
    audience: "platform",
    title: "AI credits low or exhausted",
    description: "A workspace used 90% or all of this month's AI credits.",
    defaultOn: true,
    payload: z.object({ name: text, used: count, total: z.number().int().positive() }),
    actions: ["platform.open"],
  }),
  "platform.service.check": def({
    key: "platform.service.check",
    audience: "platform",
    title: "Service check failing or recovered",
    description: "A service the platform depends on (mail, payments, models) failed its test, or works again.",
    defaultOn: true,
    payload: z.object({ service: text, state: z.enum(["failing", "recovered"]), reason: text.optional(), target: text.optional(), consequence: text.optional() }),
    actions: ["platform.open_admin_email"],
  }),
  "platform.signin.throttled": def({
    key: "platform.signin.throttled",
    audience: "platform",
    title: "Sign-in throttled repeatedly",
    description: "Many refused sign-ins for one account in a short time.",
    defaultOn: true,
    payload: z.object({ userId: userIdSchema, email: text, refused: count, addresses: count, minutes: z.number().int().positive() }),
    actions: ["platform.user.disable", "platform.open"],
  }),
  "platform.two_factor.reset": def({
    key: "platform.two_factor.reset",
    audience: "platform",
    title: "Two-factor reset by an administrator",
    description: "An administrator removed a person's two-factor enrolment.",
    defaultOn: true,
    payload: z.object({ email: text, by: text }),
    actions: ["platform.open"],
  }),
  "platform.admin.changed": def({
    key: "platform.admin.changed",
    audience: "platform",
    title: "Platform administrator added or removed",
    description: "Someone was made, or stopped being, a platform administrator.",
    defaultOn: true,
    payload: z.object({ change: z.enum(["added", "removed"]), email: text, by: text }),
    actions: ["platform.open"],
  }),
  "platform.setting.changed": def({
    key: "platform.setting.changed",
    audience: "platform",
    title: "Setting changed",
    description: "A key or setting was set, replaced or removed in Admin. The message never carries the value, only its last four characters.",
    defaultOn: true,
    payload: z.object({ by: text, setting: text, change: z.enum(["set", "replaced", "removed"]), endsWith: z.string().max(4).optional() }),
    actions: ["platform.open"],
  }),
  "platform.digest.daily": def({
    key: "platform.digest.daily",
    audience: "platform",
    title: "Daily digest",
    description: "One message each morning: yesterday's sign-ins, workspaces, active concepts, failed payments and service state.",
    defaultOn: false,
    payload: z.object({ signups: count, waiting: count, workspaces: count, concepts: count, failedPayments: count, servicesFailing: count }),
    actions: ["platform.open"],
  }),

  // --- section 3: workspace channels -----------------------------------------------------------------------------
  "workspace.gate.passed": def({
    key: "workspace.gate.passed",
    audience: "workspace",
    title: "Gate passed",
    description: "A concept passed a stage gate; the next stage's progress is shown.",
    defaultOn: true,
    payload: z.object({ ...concept, gate: text, met: count, total: count, next: z.object({ stage: text, met: count, total: count }).optional() }),
    actions: ["workspace.open_status"],
  }),
  "workspace.gate.overridden": def({
    key: "workspace.gate.overridden",
    audience: "workspace",
    title: "Gate overridden",
    description: "A person passed a gate with checks unmet and gave a reason.",
    defaultOn: true,
    payload: z.object({ ...concept, by: text, gate: text, reason: text }),
    actions: ["workspace.open"],
  }),
  "workspace.stage.blocked": def({
    key: "workspace.stage.blocked",
    audience: "workspace",
    title: "Stage blocked or unblocked",
    description: "A requirement marked blocked holds a stage, or no longer does.",
    defaultOn: true,
    payload: z.object({ ...concept, stage: text, state: z.enum(["blocked", "unblocked"]), requirement: text, requirementItemId: itemIdSchema }),
    actions: ["workspace.open_requirement"],
  }),
  "workspace.decision.waiting": def({
    key: "workspace.decision.waiting",
    audience: "workspace",
    title: "Decision waiting",
    description: "A decision is ready to be made and opens later work. It can be decided from Slack.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, question: text, opens: z.array(text) }),
    actions: ["workspace.decision.yes", "workspace.decision.no", "workspace.open"],
  }),
  "workspace.decision.made": def({
    key: "workspace.decision.made",
    audience: "workspace",
    title: "Decision made",
    description: "A person decided a question.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, by: text, question: text, answer: text }),
    actions: ["workspace.open"],
  }),
  "workspace.claim.checked": def({
    key: "workspace.claim.checked",
    audience: "workspace",
    title: "Claim verified or found wrong",
    description: "A claim was checked against its saved source.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, claim: text, result: z.enum(["verified", "wrong"]), sourceSays: text.optional() }),
    actions: ["workspace.open_claim"],
  }),
  "workspace.question.changed": def({
    key: "workspace.question.changed",
    audience: "workspace",
    title: "Open question added or answered",
    description: "An open question was added, or answered.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, change: z.enum(["added", "answered"]), question: text }),
    actions: ["workspace.question.mark_decided", "workspace.open"],
  }),
  "workspace.positioning.reviewed": def({
    key: "workspace.positioning.reviewed",
    audience: "workspace",
    title: "Positioning approved or sent back",
    description: "A positioning was approved, sent back, or cannot be approved.",
    defaultOn: true,
    payload: z.object({ ...concept, name: text, outcome: z.enum(["approved", "sent_back", "cannot_approve"]), reason: text.optional() }),
    actions: ["workspace.open"],
  }),
  "workspace.part.changed": def({
    key: "workspace.part.changed",
    audience: "workspace",
    title: "Part changed, with what depends on it",
    description: "A part's value changed, with the rows that depend on it.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, part: text, from: text, to: text, dependents: z.array(text) }),
    actions: ["workspace.open_part"],
  }),
  "workspace.cost.crossed": def({
    key: "workspace.cost.crossed",
    audience: "workspace",
    title: "Unit cost or margin crossed a line",
    description: "The unit cost moved past its threshold, or the margin on a sales channel did.",
    defaultOn: true,
    payload: z.object({
      ...concept,
      units: z.number().int().positive(),
      fromMinor: z.number().int(),
      toMinor: z.number().int(),
      ...money,
      channel: text.optional(),
      marginMinor: z.number().int().optional(),
    }),
    actions: ["workspace.open_economics"],
  }),
  "workspace.print.job": def({
    key: "workspace.print.job",
    audience: "workspace",
    title: "Print job started, finished or failed",
    description: "A print job changed state.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, job: text, state: z.enum(["started", "finished", "failed"]), printer: text, layer: count.optional(), layers: count.optional() }),
    actions: ["workspace.open_print_job"],
  }),
  "workspace.slicing.finished": def({
    key: "workspace.slicing.finished",
    audience: "workspace",
    title: "Slicing finished",
    description: "A part was sliced; the print time and material are shown.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, part: text, minutes: count, grams: z.number().nonnegative(), material: text }),
    actions: ["workspace.open"],
  }),
  "workspace.file.added": def({
    key: "workspace.file.added",
    audience: "workspace",
    title: "File added or replaced",
    description: "A file was added to Files, or a new version replaced an old one. Only the file's name is shown, never its contents.",
    defaultOn: true,
    payload: z.object({ ...concept, by: text, file: text, replaces: text.optional() }),
    actions: ["workspace.open"],
  }),
  "workspace.drafts.ready": def({
    key: "workspace.drafts.ready",
    audience: "workspace",
    title: "Draft ready for review",
    description: "The assistant drafted rows; nothing is applied until a person accepts.",
    defaultOn: true,
    payload: z.object({ ...concept, count: z.number().int().positive(), noun: text }),
    actions: ["workspace.review_drafts"],
  }),
  "workspace.launch.result": def({
    key: "workspace.launch.result",
    audience: "workspace",
    title: "Campaign or listing went live or was refused",
    description: "A campaign or a sales listing went live, or the channel refused it.",
    defaultOn: true,
    payload: z.object({ ...concept, kind: z.enum(["listing", "campaign"]), channel: text, name: text, outcome: z.enum(["live", "refused"]), reason: text.optional() }),
    actions: ["workspace.open"],
  }),
  "workspace.review.received": def({
    key: "workspace.review.received",
    audience: "workspace",
    title: "Reply or review received",
    description: "A review or a reply arrived on a sales or social channel. A reply can be drafted from Slack.",
    defaultOn: true,
    payload: z.object({ ...concept, itemId: itemIdSchema, kind: z.enum(["review", "reply"]), channel: text, rating: z.number().int().min(1).max(5).optional(), text }),
    actions: ["workspace.review.draft_reply", "workspace.open"],
  }),
  "workspace.mention": def({
    key: "workspace.mention",
    audience: "person",
    title: "Mention or assignment",
    description: "Someone mentioned you on a row, or assigned it to you. Sent to the person, not the channel.",
    defaultOn: true,
    payload: z
      .object({ ...concept, itemId: itemIdSchema, stage: text, section: text, by: text, kind: z.enum(["mention", "assignment"]), rowTitle: text })
      .refine((v) => findSection(v.stage, v.section) !== null, { message: "not a section of the menu", path: ["section"] }),
    actions: ["workspace.open"],
  }),
  "workspace.member.changed": def({
    key: "workspace.member.changed",
    audience: "workspace",
    title: "Member joined, left or changed role",
    description: "The workspace's members changed.",
    defaultOn: true,
    payload: z.object({ email: text, change: z.enum(["joined", "left", "role_changed"]), role: roleName.optional(), previousRole: roleName.optional(), invitedBy: text.optional() }),
    actions: ["workspace.open_members"],
  }),
  "workspace.summary.weekly": def({
    key: "workspace.summary.weekly",
    audience: "workspace",
    title: "Weekly summary",
    description: "One message a week per concept: gates, decisions and prints, with the next step.",
    defaultOn: false,
    payload: z.object({ ...concept, gatesPassed: count, decisionsMade: count, decisionsWaiting: count, printsFailed: count, next: text.optional() }),
    actions: ["workspace.open_status"],
  }),
} as const;

export type EventKey = keyof typeof EVENTS;
export const EVENT_KEYS = Object.keys(EVENTS) as EventKey[];

/** The facts event `K` needs, as the message builder reads them. */
export type EventPayload<K extends EventKey> = z.infer<(typeof EVENTS)[K]["payload"]>;

/** The events of one audience, in the specification's order. */
export const eventsFor = (audience: SlackAudience) => EVENT_KEYS.filter((k) => EVENTS[k].audience === audience).map((k) => EVENTS[k]);
