/**
 * The confirmation email after an early-access request: sent only when a mail server is set up in Admin, Email
 * (src/lib/admin/mail.ts). Never a blocker: the request is stored first, the email is sent after the answer is
 * decided, and a refusal or a failure is logged as one line with no address or content.
 */
import { getMailSender } from "@/lib/admin/mail";
import { outcomeMessage, type EarlyAccessOutcome } from "./shared";

const SUBJECT: Record<"place" | "waiting", string> = {
  place: "Your early-access place for Concept to Realization",
  waiting: "You are on the waiting list for Concept to Realization",
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Sends the confirmation if mail is configured. Answers whether a message went out. Never throws. */
export async function sendEarlyAccessConfirmation(to: string, outcome: EarlyAccessOutcome): Promise<boolean> {
  if (outcome.kind === "listed") return false;
  try {
    const mail = await getMailSender({ timeoutMs: 10_000 });
    if (!mail.configured) return false;
    const line = outcomeMessage(outcome);
    const text = `${line}\n\nEarly access takes no payment.\n\nIf you did not ask for this, ignore this email; nothing else will be sent.`;
    await mail.sender.send({ to, subject: SUBJECT[outcome.kind], text, html: `<p>${escapeHtml(line)}</p><p>Early access takes no payment.</p><p>If you did not ask for this, ignore this email; nothing else will be sent.</p>` });
    return true;
  } catch (e) {
    console.warn(`[early access] the confirmation email was not sent: ${(e as Error)?.name ?? "error"}`);
    return false;
  }
}
