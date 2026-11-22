/**
 * Mail for the new sign-in (trial task 4, interface only).
 *
 * One interface, MailSender: it is given a finished message (address, subject, plain text, HTML) and sends it.
 * Until the owner names a mail service, the only sender is logSender, which writes the message to the server log
 * instead of sending it. A real sender (Resend, Postmark, SMTP...) is one more object with the same `send`, chosen
 * in mailSender() below; nothing else changes.
 *
 * The three messages are built here from plain sentences, so every sender sends the same words:
 * - confirm-email: the link to confirm the address given at sign-up;
 * - reset-password: the link to choose a new password;
 * - invitation: the link to join a workspace (used from slice 2).
 * Each says what to do if the reader did not ask for it, and how long the link works.
 */
import { esc } from "@/lib/html";

const PRODUCT = "Concept to Realization";

export type MailMessage = { to: string; subject: string; text: string; html: string };

export type MailSender = { send(m: MailMessage): Promise<void> };

/** Writes the message to the server log. Not a mail service: anyone who can read the log can follow the link. */
const logSender: MailSender = {
  async send(m) {
    console.info(`[auth2 mail, not sent] to ${m.to}: ${m.subject}\n${m.text}`);
  },
};

/**
 * The sender in use. Only the log exists for now (no mail service has been chosen). In production that would put
 * every confirmation and reset link in the server log, where anyone who reads the log could use it, so there it is
 * refused and the new sign-in does not start.
 */
export function mailSender(): MailSender {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH2 is on in production but no mail service is configured (AUTH2_MAIL is not set). The only sender available writes " +
        "confirmation and reset links to the server log, which is not safe in production. Turn AUTH2 off until a mail service is set up."
    );
  }
  return logSender;
}

type Template = { subject: string; lines: string[]; action: string; after: string[] };

export type MailRequest =
  | { kind: "confirm-email"; to: string; name?: string; link: string }
  | { kind: "reset-password"; to: string; name?: string; link: string }
  | { kind: "invitation"; to: string; link: string; workspace: string; inviter: string };

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
