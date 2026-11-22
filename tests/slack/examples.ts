// The specification's example for every row of sections 2 and 3 of docs/design/slack.md, as the facts that produce
// it and the words it must come out as. Several rows have two or three examples (a row that names two outcomes).
import type { EventKey, EventPayload } from "@/lib/slack";

export type Example<K extends EventKey = EventKey> = {
  /** what the example shows, for the test name */
  name: string;
  payload: EventPayload<K>;
  /** the specification's words */
  text: string;
  /** the buttons' keys, in order */
  buttons: string[];
};

const ex = <K extends EventKey>(name: string, payload: EventPayload<K>, text: string, buttons: string[]): Example<K> => ({ name, payload, text, buttons });

const C = { conceptId: "baggage-claims", conceptName: "Baggage Claims MK1" };

export const EXAMPLES: { [K in EventKey]: Example<K>[] } = {
  "platform.access_request.received": [
    ex(
      "Dana Whitfield",
      { requestId: 7, name: "Dana Whitfield", email: "dana@example.com", level: "maker", message: "I have a bike-light idea and a 3D printer." },
      "New access request: Dana Whitfield, dana@example.com, level Maker. 'I have a bike-light idea and a 3D printer.'",
      ["platform.access_request.approve", "platform.access_request.decline", "platform.open"],
    ),
  ],
  "platform.signup.waiting": [
    ex(
      "sam waiting 4 minutes",
      { userId: "u_sam1", email: "sam@example.com", minutesAgo: 4 },
      "Sign-up waiting: sam@example.com, 4 minutes ago. No mail server is set, so an administrator confirms.",
      ["platform.signup.confirm", "platform.signup.disable", "platform.open"],
    ),
  ],
  "platform.signup.confirmed": [
    ex("sam confirmed", { email: "sam@example.com", workspaceName: "Sam's workshop" }, "sam@example.com confirmed their address and created workspace 'Sam's workshop'.", ["platform.open"]),
  ],
  "platform.workspace.changed": [
    ex("created", { change: "created", name: "Northside Makers", by: "lee@example.com", plan: "Free" }, "Workspace 'Northside Makers' created by lee@example.com (plan Free).", ["platform.open"]),
    ex("deleted", { change: "deleted", name: "Northside Makers", by: "lee@example.com" }, "Workspace 'Northside Makers' deleted by lee@example.com.", ["platform.open"]),
  ],
  "platform.plan.changed": [
    ex("Free to Maker", { name: "Northside Makers", from: "Free", to: "Maker", interval: "monthly" }, "'Northside Makers' moved from Free to Maker (monthly).", ["platform.open"]),
  ],
  "platform.payment.failed": [
    ex(
      "card declined",
      { name: "Northside Makers", reason: "card declined", amountMinor: 2900, currency: "USD", retryOn: "2026-11-25", stripeCustomerId: "cus_Abc123" },
      "Payment failed for 'Northside Makers': card declined, $29.00. Stripe retries on 25 Nov.",
      ["platform.open_stripe", "platform.open"],
    ),
  ],
  "platform.subscription.cancelled": [
    ex("Maker cancelled", { name: "Northside Makers", plan: "Maker", endsOn: "2026-12-21" }, "'Northside Makers' cancelled Maker; access ends 21 Dec.", ["platform.open"]),
  ],
  "platform.ai_credits.low": [
    ex("90 percent", { name: "Northside Makers", used: 450, total: 500 }, "'Northside Makers' has used 90% of this month's AI credits (450 of 500).", ["platform.open"]),
    ex("all used", { name: "Northside Makers", used: 500, total: 500 }, "'Northside Makers' has used all of this month's AI credits (500 of 500).", ["platform.open"]),
  ],
  "platform.service.check": [
    ex(
      "mail failing",
      { service: "Mail server", state: "failing", reason: "connection refused", target: "smtp.example.com:587", consequence: "Sign-ups now wait for an administrator." },
      "Mail server: test failed, 'connection refused' (smtp.example.com:587). Sign-ups now wait for an administrator.",
      ["platform.open_admin_email"],
    ),
    ex("mail recovered", { service: "Mail server", state: "recovered" }, "Mail server: working again.", ["platform.open_admin_email"]),
  ],
  "platform.signin.throttled": [
    ex(
      "12 refused",
      { userId: "u_lee1", email: "lee@example.com", refused: 12, addresses: 3, minutes: 10 },
      "12 refused sign-ins for lee@example.com from 3 addresses in 10 minutes.",
      ["platform.user.disable", "platform.open"],
    ),
  ],
  "platform.two_factor.reset": [
    ex("lee reset", { email: "lee@example.com", by: "admin@oxot.nl" }, "Two-factor reset for lee@example.com by admin@oxot.nl.", ["platform.open"]),
  ],
  "platform.admin.changed": [
    ex("kim added", { change: "added", email: "kim@example.com", by: "admin@oxot.nl" }, "admin@oxot.nl made kim@example.com a platform administrator.", ["platform.open"]),
    ex("kim removed", { change: "removed", email: "kim@example.com", by: "admin@oxot.nl" }, "admin@oxot.nl removed kim@example.com as a platform administrator.", ["platform.open"]),
  ],
  "platform.setting.changed": [
    ex("Stripe key", { by: "admin@oxot.nl", setting: "the Stripe secret key", change: "replaced", endsWith: "4x2Q" }, "admin@oxot.nl replaced the Stripe secret key (ends 4x2Q).", ["platform.open"]),
  ],
  "platform.digest.daily": [
    ex(
      "yesterday",
      { signups: 3, waiting: 1, workspaces: 2, concepts: 14, failedPayments: 0, servicesFailing: 0 },
      "Yesterday: 3 sign-ups (1 waiting), 2 new workspaces, 14 concepts active, 0 failed payments, all services working.",
      ["platform.open"],
    ),
  ],

  "workspace.gate.passed": [
    ex(
      "Concept gate",
      { ...C, gate: "Concept", met: 6, total: 6, next: { stage: "Research", met: 1, total: 2 } },
      "Baggage Claims MK1 passed the Concept gate (6 of 6). Next: Research, 1 of 2 checks met.",
      ["workspace.open_status"],
    ),
  ],
  "workspace.gate.overridden": [
    ex("Design override", { ...C, by: "Jim", gate: "Design", reason: "firmware check waived for the first print" }, "Jim passed the Design gate by override: 'firmware check waived for the first print'.", ["workspace.open"]),
  ],
  "workspace.stage.blocked": [
    ex(
      "Design blocked",
      { ...C, stage: "Design", state: "blocked", requirement: "Firmware sketch compiles", requirementItemId: 12 },
      "Design is blocked: the requirement 'Firmware sketch compiles' is marked blocked.",
      ["workspace.open_requirement"],
    ),
    ex(
      "Design unblocked",
      { ...C, stage: "Design", state: "unblocked", requirement: "Firmware sketch compiles", requirementItemId: 12 },
      "Design is unblocked: the requirement 'Firmware sketch compiles' is no longer blocked.",
      ["workspace.open_requirement"],
    ),
  ],
  "workspace.decision.waiting": [
    ex(
      "validation batch",
      { ...C, itemId: 31, question: "Spend about $750 on the validation batch?", opens: ["Sourcing", "3D printing", "Assembly"] },
      "Decision waiting: 'Spend about $750 on the validation batch?' It opens Sourcing, 3D printing and Assembly.",
      ["workspace.decision.yes", "workspace.decision.no", "workspace.open"],
    ),
  ],
  "workspace.decision.made": [
    ex("which name", { ...C, itemId: 8, by: "Jim", question: "Which name ships?", answer: "Baggage Claims" }, "Jim decided 'Which name ships?': Baggage Claims.", ["workspace.open"]),
  ],
  "workspace.claim.checked": [
    ex(
      "found wrong",
      { ...C, itemId: 5, claim: "US novelty market was $32.7B in 2025", result: "wrong", sourceSays: "$28.4B" },
      "Claim found wrong: 'US novelty market was $32.7B in 2025'. The saved source says $28.4B.",
      ["workspace.open_claim"],
    ),
    ex("verified", { ...C, itemId: 5, claim: "US novelty market was $28.4B in 2025", result: "verified" }, "Claim verified: 'US novelty market was $28.4B in 2025'. The saved source supports it.", ["workspace.open_claim"]),
  ],
  "workspace.question.changed": [
    ex(
      "added",
      { ...C, itemId: 14, change: "added", question: "Will a talking tag pass airline rules?" },
      "New open question on Baggage Claims MK1: 'Will a talking tag pass airline rules?'",
      ["workspace.question.mark_decided", "workspace.open"],
    ),
    ex(
      "answered",
      { ...C, itemId: 14, change: "answered", question: "Will a talking tag pass airline rules?" },
      "Open question answered on Baggage Claims MK1: 'Will a talking tag pass airline rules?'",
      ["workspace.question.mark_decided", "workspace.open"],
    ),
  ],
  "workspace.positioning.reviewed": [
    ex(
      "cannot approve",
      { ...C, name: "The bag that talks back", outcome: "cannot_approve", reason: "no message has proof" },
      "Positioning 'The bag that talks back' cannot be approved: no message has proof.",
      ["workspace.open"],
    ),
    ex("approved", { ...C, name: "The bag that talks back", outcome: "approved" }, "Positioning 'The bag that talks back' approved.", ["workspace.open"]),
    ex("sent back", { ...C, name: "The bag that talks back", outcome: "sent_back", reason: "The second message needs a source" }, "Positioning 'The bag that talks back' was sent back. The second message needs a source.", ["workspace.open"]),
  ],
  "workspace.part.changed": [
    ex(
      "speaker",
      { ...C, itemId: 3, part: "Speaker", from: "28 mm", to: "23 mm", dependents: ["enclosure grille", "assembly step 4", "unit cost"] },
      "Speaker changed from 28 mm to 23 mm. Depends on it: enclosure grille, assembly step 4, unit cost.",
      ["workspace.open_part"],
    ),
  ],
  "workspace.cost.crossed": [
    ex(
      "unit cost rose",
      { ...C, units: 5, fromMinor: 6120, toMinor: 6480, currency: "USD", channel: "Amazon FBA", marginMinor: -3685 },
      "Unit cost at 5 units rose from $61.20 to $64.80; margin on Amazon FBA is now −$36.85.",
      ["workspace.open_economics"],
    ),
  ],
  "workspace.print.job": [
    ex(
      "failed",
      { ...C, itemId: 9, job: "Tag base, PETG", state: "failed", printer: "Bambu P1S", layer: 41, layers: 212 },
      "Print failed: 'Tag base, PETG' at layer 41 of 212 on Bambu P1S.",
      ["workspace.open_print_job"],
    ),
    ex("started", { ...C, itemId: 9, job: "Tag base, PETG", state: "started", printer: "Bambu P1S" }, "Print started: 'Tag base, PETG' on Bambu P1S.", ["workspace.open_print_job"]),
    ex("finished", { ...C, itemId: 9, job: "Tag base, PETG", state: "finished", printer: "Bambu P1S" }, "Print finished: 'Tag base, PETG' on Bambu P1S.", ["workspace.open_print_job"]),
  ],
  "workspace.slicing.finished": [
    ex("tag lid", { ...C, itemId: 10, part: "Tag lid", minutes: 134, grams: 38, material: "PETG" }, "Sliced 'Tag lid': 2 h 14 min, 38 g PETG.", ["workspace.open"]),
  ],
  "workspace.file.added": [
    ex("build guide", { ...C, by: "Jim", file: "BuildGuide_RevB.pdf", replaces: "Rev A" }, "Jim added 'BuildGuide_RevB.pdf' to Files (replaces Rev A).", ["workspace.open"]),
    ex("new file", { ...C, by: "Jim", file: "BuildGuide_RevA.pdf" }, "Jim added 'BuildGuide_RevA.pdf' to Files.", ["workspace.open"]),
  ],
  "workspace.drafts.ready": [
    ex(
      "six requirements",
      { ...C, count: 6, noun: "requirement" },
      "The assistant drafted 6 requirements for Baggage Claims MK1. Nothing is applied until you accept.",
      ["workspace.review_drafts"],
    ),
  ],
  "workspace.launch.result": [
    ex("live", { ...C, kind: "listing", channel: "Amazon", name: "Baggage Claims MK1", outcome: "live" }, "Amazon listing 'Baggage Claims MK1' is live.", ["workspace.open"]),
    ex(
      "refused",
      { ...C, kind: "listing", channel: "Amazon", name: "Baggage Claims MK1", outcome: "refused", reason: "missing proof for 'lasts a full trip'" },
      "Listing refused: missing proof for 'lasts a full trip'.",
      ["workspace.open"],
    ),
  ],
  "workspace.review.received": [
    ex("two stars", { ...C, itemId: 21, kind: "review", channel: "Amazon", rating: 2, text: "Battery door is loose." }, "New Amazon review, 2 stars: 'Battery door is loose.'", ["workspace.review.draft_reply", "workspace.open"]),
  ],
  "workspace.mention": [
    ex(
      "Lee mentioned you",
      { ...C, itemId: 33, stage: "concept", section: "decisions", by: "Lee", kind: "mention", rowTitle: "Which enclosure build?" },
      "Lee mentioned you on 'Which enclosure build?'",
      ["workspace.open"],
    ),
  ],
  "workspace.member.changed": [
    ex("kim joined", { email: "kim@example.com", change: "joined", role: "member", invitedBy: "Lee" }, "kim@example.com joined as member, invited by Lee.", ["workspace.open_members"]),
    ex("kim left", { email: "kim@example.com", change: "left" }, "kim@example.com left the workspace.", ["workspace.open_members"]),
    ex("kim role", { email: "kim@example.com", change: "role_changed", previousRole: "member", role: "admin" }, "kim@example.com changed from member to admin.", ["workspace.open_members"]),
  ],
  "workspace.summary.weekly": [
    ex(
      "this week",
      { ...C, gatesPassed: 1, decisionsMade: 3, decisionsWaiting: 2, printsFailed: 1, next: "verify 8 claims" },
      "This week on Baggage Claims MK1: 1 gate passed, 3 decisions made, 2 waiting, 1 print failed. Next: verify 8 claims.",
      ["workspace.open_status"],
    ),
  ],
};

/** An event's examples with the facts loosely typed, for tests that go through every event in one loop. */
export const examplesOf = (key: EventKey): { name: string; payload: never; text: string; buttons: string[] }[] => EXAMPLES[key] as unknown as { name: string; payload: never; text: string; buttons: string[] }[];
