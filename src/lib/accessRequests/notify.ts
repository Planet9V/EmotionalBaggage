/**
 * Sign-up requests go to the owner (ruling of 23 Nov: "request to sign up goes to jim@eigenia.nl"). Each new
 * early-access request, and each request for an account while self sign-up is closed, is announced by email to the
 * address in `notify.signupRequestsTo` (default jim@eigenia.nl; Admin, Email), when a mail server is set up. It is
 * always listed in Admin, Access requests as well. The message says who asked and what they want to make, with a
 * link to Admin; it holds no token, password or secret. Never a blocker: it runs after the answer and never throws.
 */
import { getMailSender } from "@/lib/admin/mail";
import { resolveAuth2Config } from "@/lib/auth2/config";
import { readRules } from "@/lib/auth2/rules";
import { ownerPool } from "@/lib/db";

export type SignupRequest = { kind: "early-access" | "account"; email: string; name: string; company: string; building: string; level: string; outcome: string };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const oneLine = (s: string, max = 300) => s.replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, max);

/** Sends the notice if an address is set and mail is set up. Answers whether a message went out. */
export async function notifySignupRequest(r: SignupRequest): Promise<boolean> {
  try {
    const db = ownerPool();
    const to = (await readRules(db)).notifySignupRequestsTo;
    if (!to) return false;
    const mail = await getMailSender({ timeoutMs: 10_000 });
    if (!mail.configured) return false;
    const base = (await resolveAuth2Config(db)).baseURL ?? "";
    const link = `${base.replace(/\/+$/, "")}/admin?tab=access`;
    const what = r.kind === "account" ? "an account" : "early access";
    const rows: [string, string][] = [
      ["Email", r.email],
      ["Name", r.name || "not given"],
      ["Company", r.company || "not given"],
      ["Plan", r.level || "not chosen"],
      ["Wants to make", oneLine(r.building, 2000)],
      ["Outcome", r.outcome],
    ];
    const subject = oneLine(`New request for ${what}: ${r.email}`, 200);
    const text = [`Someone asked for ${what} on Shipwright.`, "", ...rows.map(([k, v]) => `${k}: ${oneLine(v, 2000)}`), "", `Open Admin, Access requests: ${link}`].join("\n");
    const html = `<p>Someone asked for ${what} on Shipwright.</p><table>${rows.map(([k, v]) => `<tr><th align="left">${k}</th><td>${escapeHtml(oneLine(v, 2000))}</td></tr>`).join("")}</table><p><a href="${escapeHtml(link)}">Open Admin, Access requests</a></p>`;
    await mail.sender.send({ to, subject, text, html });
    return true;
  } catch (e) {
    console.warn(`[access requests] the notice to the owner was not sent: ${(e as Error)?.name ?? "error"}`);
    return false;
  }
}
