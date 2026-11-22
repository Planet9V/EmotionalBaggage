// The platform channel's messages (section 2 of docs/design/slack.md): one pure function per event, from its facts to a
// Slack message. Wording follows the specification's examples. User words go through `m` (escaped, one line, cut), so
// they cannot mention anyone or form a link. Nothing here carries a secret, a password or a sign-in link.
import { ACCESS_LEVEL_LABEL } from "@/lib/accessRequests/shared";
import { formatMoney } from "@/lib/economics/money";
import { plural } from "@/lib/format";
import { linkButton, message, valueButton, type SlackMessage } from "./build";
import type { EventPayload } from "./events";
import { adminLink, stripeLink, type SlackContext } from "./links";
import { long, m } from "./text";

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * "25 Nov" for a stored date ("2026-11-25"). Not `fmtDate` from src/lib/format.ts: that one uses the machine's locale
 * and time zone (so "Nov 24" on a US server), which is right for a screen the person looks at but not for a message
 * the server writes once for everyone.
 */
export const dayMonth = (isoDate: string): string => DAY_MONTH.format(new Date(`${isoDate}T00:00:00Z`));

/** Money through the app's formatter, with the true minus sign the specification's example uses ("−$36.85"). */
export const money = (minor: number, currency: string): string => formatMoney(minor, currency).replace(/^-/, "−");

type Build<K extends keyof PlatformPayloads> = (p: PlatformPayloads[K], ctx: SlackContext) => SlackMessage;
type PlatformPayloads = {
  "platform.access_request.received": EventPayload<"platform.access_request.received">;
  "platform.signup.waiting": EventPayload<"platform.signup.waiting">;
  "platform.signup.confirmed": EventPayload<"platform.signup.confirmed">;
  "platform.workspace.changed": EventPayload<"platform.workspace.changed">;
  "platform.plan.changed": EventPayload<"platform.plan.changed">;
  "platform.payment.failed": EventPayload<"platform.payment.failed">;
  "platform.subscription.cancelled": EventPayload<"platform.subscription.cancelled">;
  "platform.ai_credits.low": EventPayload<"platform.ai_credits.low">;
  "platform.service.check": EventPayload<"platform.service.check">;
  "platform.signin.throttled": EventPayload<"platform.signin.throttled">;
  "platform.two_factor.reset": EventPayload<"platform.two_factor.reset">;
  "platform.admin.changed": EventPayload<"platform.admin.changed">;
  "platform.setting.changed": EventPayload<"platform.setting.changed">;
  "platform.digest.daily": EventPayload<"platform.digest.daily">;
};


export const PLATFORM_MESSAGES: { [K in keyof PlatformPayloads]: Build<K> } = {
  "platform.access_request.received": (p, ctx) => {
    const level = p.level ? m`, level ${ACCESS_LEVEL_LABEL[p.level]}` : m``;
    const said = p.message.trim() ? m` '${long(p.message)}'` : m``;
    return message(m`New access request: ${p.name}, ${p.email}${level}.${said}`, [
      valueButton("platform.access_request.approve", { requestId: p.requestId }),
      valueButton("platform.access_request.decline", { requestId: p.requestId }),
      linkButton("platform.open", adminLink(ctx, "access")),
    ]);
  },

  "platform.signup.waiting": (p, ctx) =>
    message(m`Sign-up waiting: ${p.email}, ${plural(p.minutesAgo, "minute")} ago. No mail server is set, so an administrator confirms.`, [
      valueButton("platform.signup.confirm", { userId: p.userId }),
      valueButton("platform.signup.disable", { userId: p.userId }),
      linkButton("platform.open", adminLink(ctx)),
    ]),

  "platform.signup.confirmed": (p, ctx) =>
    message(m`${p.email} confirmed their address and created workspace '${p.workspaceName}'.`, [linkButton("platform.open", adminLink(ctx))]),

  "platform.workspace.changed": (p, ctx) => {
    const text =
      p.change === "created"
        ? m`Workspace '${p.name}' created by ${p.by}${p.plan ? m` (plan ${p.plan})` : m``}.`
        : m`Workspace '${p.name}' deleted by ${p.by}.`;
    return message(text, [linkButton("platform.open", adminLink(ctx))]);
  },

  "platform.plan.changed": (p, ctx) =>
    message(m`'${p.name}' moved from ${p.from} to ${p.to}${p.interval ? m` (${p.interval})` : m``}.`, [linkButton("platform.open", adminLink(ctx))]),

  "platform.payment.failed": (p, ctx) => {
    const retry = p.retryOn ? `Stripe retries on ${dayMonth(p.retryOn)}.` : "Stripe has no retry scheduled.";
    return message(m`Payment failed for '${p.name}': ${p.reason}, ${money(p.amountMinor, p.currency)}. ${retry}`, [
      linkButton("platform.open_stripe", stripeLink(p.stripeCustomerId)),
      linkButton("platform.open", adminLink(ctx)),
    ]);
  },

  "platform.subscription.cancelled": (p, ctx) =>
    message(m`'${p.name}' cancelled ${p.plan}; access ends ${dayMonth(p.endsOn)}.`, [linkButton("platform.open", adminLink(ctx))]),

  "platform.ai_credits.low": (p, ctx) => {
    const percent = Math.floor((p.used / p.total) * 100);
    const text =
      p.used >= p.total
        ? m`'${p.name}' has used all of this month's AI credits (${p.total.toLocaleString("en-US")} of ${p.total.toLocaleString("en-US")}).`
        : m`'${p.name}' has used ${percent}% of this month's AI credits (${p.used.toLocaleString("en-US")} of ${p.total.toLocaleString("en-US")}).`;
    return message(text, [linkButton("platform.open", adminLink(ctx))]);
  },

  "platform.service.check": (p, ctx) => {
    const text =
      p.state === "recovered"
        ? m`${p.service}: working again.`
        : m`${p.service}: test failed${p.reason ? m`, '${p.reason}'` : m``}${p.target ? m` (${p.target})` : m``}.${p.consequence ? m` ${p.consequence}` : m``}`;
    return message(text, [linkButton("platform.open_admin_email", adminLink(ctx, "credentials"))]);
  },

  "platform.signin.throttled": (p, ctx) =>
    message(m`${plural(p.refused, "refused sign-in")} for ${p.email} from ${plural(p.addresses, "address", "addresses")} in ${plural(p.minutes, "minute")}.`, [
      valueButton("platform.user.disable", { userId: p.userId }),
      linkButton("platform.open", adminLink(ctx, "audit")),
    ]),

  "platform.two_factor.reset": (p, ctx) =>
    message(m`Two-factor reset for ${p.email} by ${p.by}.`, [linkButton("platform.open", adminLink(ctx, "audit"))]),

  "platform.admin.changed": (p, ctx) =>
    message(p.change === "added" ? m`${p.by} made ${p.email} a platform administrator.` : m`${p.by} removed ${p.email} as a platform administrator.`, [
      linkButton("platform.open", adminLink(ctx, "audit")),
    ]),

  // Never the value: only the last four characters, and only what the caller gave (cut again here, as a second guard).
  "platform.setting.changed": (p, ctx) => {
    const ends = p.endsWith ? m` (ends ${p.endsWith.slice(-4)})` : m``;
    const verb = p.change === "removed" ? "removed" : p.change === "set" ? "set" : "replaced";
    return message(m`${p.by} ${verb} ${p.setting}${ends}.`, [linkButton("platform.open", adminLink(ctx, "audit"))]);
  },

  "platform.digest.daily": (p, ctx) => {
    const services = p.servicesFailing > 0 ? plural(p.servicesFailing, "service") + " failing" : "all services working";
    return message(
      m`Yesterday: ${plural(p.signups, "sign-up")} (${p.waiting} waiting), ${plural(p.workspaces, "new workspace")}, ${plural(p.concepts, "concept")} active, ${plural(p.failedPayments, "failed payment")}, ${services}.`,
      [linkButton("platform.open", adminLink(ctx))],
    );
  },
};

