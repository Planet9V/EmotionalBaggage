/**
 * Mail for the new sign-in. One interface; until the owner names a mail service, the only sender writes each
 * message to the server log instead of sending it (owner's ruling, docs/plan-2026-11-22-parallel-delivery.md).
 */
export type MailKind = "confirm-email" | "reset-password" | "invitation";

export type MailRequest = { kind: MailKind; to: string; name?: string; link: string };

export type MailSender = { send(m: MailRequest): Promise<void> };

/** Writes the message to the server log. Not a mail service. */
export const logSender: MailSender = {
  async send(m) {
    console.info(`[auth2 mail, not sent] ${m.kind} to ${m.to}: ${m.link}`);
  },
};
