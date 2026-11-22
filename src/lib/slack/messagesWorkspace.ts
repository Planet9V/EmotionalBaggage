// The workspace channels' messages (section 3 of docs/design/slack.md): one pure function per event. Same rules as the
// platform messages (messagesPlatform.ts). Links go to the app's own pages for the concept; a button that decides
// something carries the concept and the row, and the server checks the person's role again (step 3).
import { formatMoney } from "@/lib/economics/money";
import { fmtMinutes, plural } from "@/lib/format";
import { linkButton, message, valueButton, type SlackButton, type SlackMessage } from "./build";
import type { EventKey, EventPayload } from "./events";
import { accountLink, pageLink, sectionLink, type SlackContext } from "./links";
import { Safe, list, long, m } from "./text";

type WorkspaceKey = Extract<EventKey, `workspace.${string}`>;
type Build<K extends WorkspaceKey> = (p: EventPayload<K>, ctx: SlackContext) => SlackMessage;

const minus = (minor: number, currency: string) => formatMoney(minor, currency).replace(/^-/, "−");

/** The message with the concept's name on a context line, unless the text already names it. */
function forConcept(text: Safe, conceptName: string, buttons: SlackButton[]): SlackMessage {
  const name = long(conceptName, 200);
  return message(text, buttons, text.text.includes(name.text) ? undefined : m`Concept: ${name}`);
}

/** "Sentence." from a reason that may or may not end in a full stop. */
const stopped = (s: Safe): Safe => (/[.!?]$/.test(s.text) ? s : m`${s}.`);

export const WORKSPACE_MESSAGES: { [K in WorkspaceKey]: Build<K> } = {
  "workspace.gate.passed": (p, ctx) => {
    const next = p.next ? m` Next: ${p.next.stage}, ${p.next.met} of ${plural(p.next.total, "check")} met.` : m``;
    return forConcept(m`${p.conceptName} passed the ${p.gate} gate (${p.met} of ${p.total}).${next}`, p.conceptName, [
      linkButton("workspace.open_status", pageLink(ctx, "/status", p.conceptId)),
    ]);
  },

  "workspace.gate.overridden": (p, ctx) =>
    forConcept(m`${p.by} passed the ${p.gate} gate by override: '${long(p.reason)}'.`, p.conceptName, [
      linkButton("workspace.open", pageLink(ctx, "/process", p.conceptId)),
    ]),

  "workspace.stage.blocked": (p, ctx) => {
    const text =
      p.state === "blocked"
        ? m`${p.stage} is blocked: the requirement '${p.requirement}' is marked blocked.`
        : m`${p.stage} is unblocked: the requirement '${p.requirement}' is no longer blocked.`;
    return forConcept(text, p.conceptName, [linkButton("workspace.open_requirement", sectionLink(ctx, p.conceptId, "design", "requirements", p.requirementItemId))]);
  },

  "workspace.decision.waiting": (p, ctx) => {
    const opens = p.opens.length ? m` It opens ${list(p.opens)}.` : m``;
    return forConcept(m`Decision waiting: '${long(p.question)}'${opens}`, p.conceptName, [
      valueButton("workspace.decision.yes", { conceptId: p.conceptId, itemId: p.itemId }),
      valueButton("workspace.decision.no", { conceptId: p.conceptId, itemId: p.itemId }),
      linkButton("workspace.open", sectionLink(ctx, p.conceptId, "concept", "decisions", p.itemId)),
    ]);
  },

  "workspace.decision.made": (p, ctx) =>
    forConcept(m`${p.by} decided '${long(p.question)}': ${long(p.answer)}.`, p.conceptName, [
      linkButton("workspace.open", sectionLink(ctx, p.conceptId, "concept", "decisions", p.itemId)),
    ]),

  "workspace.claim.checked": (p, ctx) => {
    const text =
      p.result === "wrong"
        ? m`Claim found wrong: '${long(p.claim)}'.${p.sourceSays ? m` The saved source says ${p.sourceSays}.` : m``}`
        : m`Claim verified: '${long(p.claim)}'. The saved source supports it.`;
    return forConcept(text, p.conceptName, [linkButton("workspace.open_claim", sectionLink(ctx, p.conceptId, "research", "claims", p.itemId))]);
  },

  "workspace.question.changed": (p, ctx) =>
    forConcept(
      p.change === "added" ? m`New open question on ${p.conceptName}: '${long(p.question)}'` : m`Open question answered on ${p.conceptName}: '${long(p.question)}'`,
      p.conceptName,
      [
        valueButton("workspace.question.mark_decided", { conceptId: p.conceptId, itemId: p.itemId }),
        linkButton("workspace.open", sectionLink(ctx, p.conceptId, "concept", "questions", p.itemId)),
      ],
    ),

  "workspace.positioning.reviewed": (p, ctx) => {
    const reason = p.reason?.trim() ? stopped(long(p.reason)) : null;
    const text =
      p.outcome === "approved"
        ? m`Positioning '${p.name}' approved.`
        : p.outcome === "sent_back"
          ? m`Positioning '${p.name}' was sent back.${reason ? m` ${reason}` : m``}`
          : m`Positioning '${p.name}' cannot be approved${reason ? m`: ${reason}` : m`.`}`;
    return forConcept(text, p.conceptName, [linkButton("workspace.open", sectionLink(ctx, p.conceptId, "marketing", "positioning"))]);
  },

  "workspace.part.changed": (p, ctx) => {
    const depends = p.dependents.length ? m` Depends on it: ${long(p.dependents.join(", "))}.` : m` Nothing else depends on it.`;
    return forConcept(m`${p.part} changed from ${p.from} to ${p.to}.${depends}`, p.conceptName, [
      linkButton("workspace.open_part", sectionLink(ctx, p.conceptId, "design", "bom", p.itemId)),
    ]);
  },

  "workspace.cost.crossed": (p, ctx) => {
    const margin = p.marginMinor !== undefined ? m`; margin${p.channel ? m` on ${p.channel}` : m``} is now ${minus(p.marginMinor, p.currency)}` : m``;
    const verb = p.toMinor >= p.fromMinor ? "rose" : "fell";
    return forConcept(
      m`Unit cost at ${plural(p.units, "unit")} ${verb} from ${minus(p.fromMinor, p.currency)} to ${minus(p.toMinor, p.currency)}${margin}.`,
      p.conceptName,
      [linkButton("workspace.open_economics", sectionLink(ctx, p.conceptId, "production", "economics"))],
    );
  },

  "workspace.print.job": (p, ctx) => {
    const at = p.state === "failed" && p.layer !== undefined && p.layers !== undefined ? m` at layer ${p.layer} of ${p.layers}` : m``;
    return forConcept(m`Print ${p.state}: '${p.job}'${at} on ${p.printer}.`, p.conceptName, [
      linkButton("workspace.open_print_job", sectionLink(ctx, p.conceptId, "prototype", "printing", p.itemId)),
    ]);
  },

  "workspace.slicing.finished": (p, ctx) =>
    forConcept(m`Sliced '${p.part}': ${fmtMinutes(p.minutes)}, ${Math.round(p.grams)} g ${p.material}.`, p.conceptName, [
      linkButton("workspace.open", sectionLink(ctx, p.conceptId, "prototype", "printing", p.itemId)),
    ]),

  "workspace.file.added": (p, ctx) =>
    forConcept(m`${p.by} added '${p.file}' to Files${p.replaces ? m` (replaces ${p.replaces})` : m``}.`, p.conceptName, [
      linkButton("workspace.open", pageLink(ctx, "/files", p.conceptId)),
    ]),

  "workspace.drafts.ready": (p, ctx) =>
    forConcept(m`The assistant drafted ${plural(p.count, p.noun)} for ${p.conceptName}. Nothing is applied until you accept.`, p.conceptName, [
      linkButton("workspace.review_drafts", pageLink(ctx, "/drafts", p.conceptId)),
    ]),

  "workspace.launch.result": (p, ctx) => {
    const noun = p.kind === "listing" ? "listing" : "campaign";
    const text =
      p.outcome === "live"
        ? m`${p.channel} ${noun} '${p.name}' is live.`
        : m`${p.kind === "listing" ? "Listing" : "Campaign"} refused:${p.reason?.trim() ? m` ${stopped(long(p.reason))}` : m` ${p.channel} did not say why.`}`;
    const where = p.kind === "listing" ? sectionLink(ctx, p.conceptId, "sales", "listing") : sectionLink(ctx, p.conceptId, "marketing", "campaigns");
    return forConcept(text, p.conceptName, [linkButton("workspace.open", where)]);
  },

  "workspace.review.received": (p, ctx) => {
    const text =
      p.kind === "review"
        ? m`New ${p.channel} review${p.rating ? m`, ${plural(p.rating, "star")}` : m``}: '${long(p.text)}'`
        : m`New ${p.channel} reply: '${long(p.text)}'`;
    return forConcept(text, p.conceptName, [
      valueButton("workspace.review.draft_reply", { conceptId: p.conceptId, itemId: p.itemId }),
      linkButton("workspace.open", sectionLink(ctx, p.conceptId, "sales", "reviews", p.itemId)),
    ]);
  },

  "workspace.mention": (p, ctx) =>
    forConcept(p.kind === "mention" ? m`${p.by} mentioned you on '${p.rowTitle}'` : m`${p.by} assigned you '${p.rowTitle}'`, p.conceptName, [
      linkButton("workspace.open", sectionLink(ctx, p.conceptId, p.stage, p.section, p.itemId)),
    ]),

  "workspace.member.changed": (p, ctx) => {
    const text =
      p.change === "joined"
        ? m`${p.email} joined as ${p.role ?? "member"}${p.invitedBy ? m`, invited by ${p.invitedBy}` : m``}.`
        : p.change === "left"
          ? m`${p.email} left the workspace.`
          : m`${p.email} changed from ${p.previousRole ?? "member"} to ${p.role ?? "member"}.`;
    return message(text, [linkButton("workspace.open_members", accountLink(ctx))]);
  },

  "workspace.summary.weekly": (p, ctx) => {
    const next = p.next ? m` Next: ${p.next}.` : m``;
    return forConcept(
      m`This week on ${p.conceptName}: ${plural(p.gatesPassed, "gate")} passed, ${plural(p.decisionsMade, "decision")} made, ${p.decisionsWaiting} waiting, ${plural(p.printsFailed, "print")} failed.${next}`,
      p.conceptName,
      [linkButton("workspace.open_status", pageLink(ctx, "/status", p.conceptId))],
    );
  },
};
