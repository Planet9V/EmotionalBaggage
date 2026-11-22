// Email settings (Admin, Email) and the one accessor every sender of mail calls: getMailSender().
// The server, port, security, sender and user name are the settings row "mail.smtp"; the password is the
// credential smtp.password, bound to the server it was saved for (src/lib/secretOrigin.ts).
import { getSetting, SETTING } from "@/lib/settings";
import { secretFor, smtpOrigin } from "@/lib/secretOrigin";
import type { MailMessage, MailSender } from "@/lib/auth2/mail";
import { smtpSender, type SmtpSender } from "@/lib/auth2/smtpSender";
import { mailSettings, type MailSettings } from "./schemas";

/** The saved mail settings; "none" (send nothing) when nothing valid is saved. */
export async function readMailSettings(): Promise<MailSettings> {
  const raw = await getSetting<unknown>(SETTING.mail, null);
  const r = mailSettings.safeParse(raw);
  return r.success ? r.data : { mode: "none" };
}

/** Thrown by the "not configured" sender, so the caller can say plainly that no mail was sent. */
export class MailNotConfigured extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "MailNotConfigured";
  }
}

/**
 * The sender when no mail server is set up. It sends nothing and refuses with MailNotConfigured. It writes one
 * line to the log with the subject only: never the address, the text or a link, because a confirmation or reset
 * link in the log would let anyone who reads the log use it.
 */
function notConfiguredSender(reason: string): MailSender {
  return {
    async send(m: MailMessage) {
      console.warn(`[mail] not sent, no mail server is set up (Admin, Email): "${m.subject.slice(0, 120)}"`);
      throw new MailNotConfigured(reason);
    },
  };
}

export type MailSetup =
  | { configured: true; sender: SmtpSender; from: { name: string; address: string }; server: string }
  | { configured: false; reason: string; sender: MailSender };

/**
 * The mail sender in force. Never throws: with no mail server, or a password saved for another server, it answers
 * `configured: false` with a sentence, and a sender that refuses without logging any content.
 */
export async function getMailSender(opts: { timeoutMs?: number } = {}): Promise<MailSetup> {
  const s = await readMailSettings();
  if (s.mode === "none") {
    const reason = "No mail server is set up, so no email is sent. Set one up in Admin, Email.";
    return { configured: false, reason, sender: notConfiguredSender(reason) };
  }
  const origin = smtpOrigin(s.host, s.port)!;
  const pw = await secretFor("smtp", "password", origin);
  if (pw.refused) {
    const reason = `The saved mail password was saved for ${pw.boundTo ?? "another server"}, not ${origin}. Type it again in Admin, Email.`;
    return { configured: false, reason, sender: notConfiguredSender(reason) };
  }
  if (s.username && !pw.value) {
    const reason = "A user name is set for the mail server but no password is saved. Add it in Admin, Email.";
    return { configured: false, reason, sender: notConfiguredSender(reason) };
  }
  const sender = smtpSender({ host: s.host, port: s.port, security: s.security, username: s.username, password: pw.value, fromName: s.fromName, fromAddress: s.fromAddress, timeoutMs: opts.timeoutMs });
  return { configured: true, sender, from: { name: s.fromName, address: s.fromAddress }, server: `${s.host}:${s.port}` };
}
