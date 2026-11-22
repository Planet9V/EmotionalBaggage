/**
 * Mail for the new sign-in (trial task 4, interface only).
 *
 * One interface, MailSender: it is given a finished message (address, subject, plain text, HTML) and sends it.
 * Which sender is used is decided by currentMailSender() below, the one place a configured mail service plugs in.
 *
 * The three messages are built here from plain sentences, so every sender sends the same words:
 * - confirm-email: the link to confirm the address given at sign-up;
 * - reset-password: the link to choose a new password;
 * - invitation: the link to join a workspace;
 * - two-factor-reset: a notice that an owner or admin reset the person's two-step sign-in.
 * Each says what to do if the reader did not ask for it, and how long the link works.
 */
import { esc } from "@/lib/html";

const PRODUCT = "Concept to Realization";

export type MailMessage = { to: string; subject: string; text: string; html: string };

export type MailSender = { send(m: MailMessage): Promise<void> };

/** Writes the message to the server log. Not a mail service: anyone who can read the log can follow the link, so it
 *  is used only outside production. */
const logSender: MailSender = {
  async send(m) {
    console.info(`[auth2 mail, not sent] to ${m.to}: ${m.subject}\n${m.text}`);
  },
};

/**
 * Where a configured mail service plugs in. Another change adds SMTP settings in the admin area and a
 * `getMailSender()` beside this file; it is wired here, in this one place, and nowhere else. Until then: none.
 */
const configuredSender = async (): Promise<MailSender | null> => null;

/**
 * The one function every caller uses to send mail (owner's ruling: mail must never stop the app running).
 * Answers the configured sender; with none, the log outside production; in production with none, null: "no mail"
 * mode, in which nothing is sent and no link or token is written anywhere. In that mode sign-up leaves the account
 * for an administrator to confirm, a password reset is asked of an administrator, and an invitation's link is
 * handed to the person who made it (src/lib/auth2/workspaces/invitations.ts).
 */
export async function currentMailSender(): Promise<MailSender | null> {
  const configured = await configuredSender();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : logSender;
}

type Template = { subject: string; lines: string[]; action: string; after: string[] };

export type MailRequest =
  | { kind: "confirm-email"; to: string; name?: string; link: string }
  | { kind: "reset-password"; to: string; name?: string; link: string }
  | { kind: "invitation"; to: string; link: string; workspace: string; inviter: string }
  | { kind: "two-factor-reset"; to: string; name?: string; link: string; workspace: string; by: string };

function template(r: MailRequest): Template {
  switch (r.kind) {
    case "confirm-email":
      return {
        subject: `Confirm your email address for ${PRODUCT}`,
        lines: [`You created an account on ${PRODUCT} with this address. Confirm it to sign in.`],
        action: "Confirm my address",
        after: ["The link works for 24 hours.", "If you did not create an account, you can ignore this email: nothing happens until the link is followed."],
      };
    case "reset-password":
      return {
        subject: `Choose a new password for ${PRODUCT}`,
        lines: ["Someone asked to reset the password of the account with this address. Follow the link to choose a new one."],
        action: "Choose a new password",
        after: [
          "The link works once, for one hour. Choosing a new password signs this account out everywhere.",
          "If you did not ask for this, ignore this email: your password stays as it is.",
        ],
      };
    case "two-factor-reset":
      return {
        subject: `Your two-step sign-in on ${PRODUCT} was reset`,
        lines: [
          `${r.by}, who manages ${r.workspace}, removed the authenticator app and the recovery codes from your account. Every browser signed in to it has been signed out.`,
          "Next time you sign in with your password, you will be asked to set up an authenticator app again.",
        ],
        action: "Sign in",
        after: ["If you did not ask for this, tell the owner of the workspace and change your password."],
      };
    case "invitation":
      return {
        subject: `${r.inviter} invited you to ${r.workspace} on ${PRODUCT}`,
        lines: [`${r.inviter} invited you to work in ${r.workspace} on ${PRODUCT}.`],
        action: "Join the workspace",
        after: ["The invitation works for 48 hours and only for this email address.", "If you were not expecting it, ignore this email."],
      };
  }
}

/** The finished message for a request: the same words as plain text and as HTML. */
export function render(r: MailRequest): MailMessage {
  const t = template(r);
  const greeting = "name" in r && r.name ? `Hello ${r.name},` : "Hello,";
  const text = [greeting, "", ...t.lines, "", `${t.action}: ${r.link}`, "", ...t.after, "", `${PRODUCT}`].join("\n");
  const html = [
    `<p>${esc(greeting)}</p>`,
    ...t.lines.map((l) => `<p>${esc(l)}</p>`),
    `<p><a href="${esc(r.link)}">${esc(t.action)}</a></p>`,
    `<p>If the button does not work, copy this address into your browser:<br>${esc(r.link)}</p>`,
    ...t.after.map((l) => `<p>${esc(l)}</p>`),
    `<p>${esc(PRODUCT)}</p>`,
  ].join("\n");
  return { to: r.to, subject: t.subject, text, html };
}
