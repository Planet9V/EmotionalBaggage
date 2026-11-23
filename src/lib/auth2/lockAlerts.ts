/**
 * The alert email when an address is locked after failed sign-ins (owner's answer of 23 Nov: "an email alert is sent
 * to jim@eigenia.nl"). Sent to `notify.lockAlertsTo` (default jim@eigenia.nl; Admin, Email) when mail is set up.
 *
 * It says which account (or "an address with no account", never the address tried or its hash), when, how many
 * failures, how long the lock lasts, and links to Admin, Users. No password, token or network address: the app keeps
 * network addresses only inside the sign-in throttle and they are not copied here.
 *
 * Limits, so guessing cannot flood the inbox: one alert per lock (./signInWait.ts calls this only when a lock is
 * newly set), and at most MAX_PER_HOUR alerts an hour overall; the next one in that hour is a single "more locks are
 * happening; see the audit log" notice, then nothing until the hour has passed. Every lock is in the audit log
 * whatever happens here. Never throws.
 */
import type { Pool } from "pg";
import { getMailSender } from "@/lib/admin/mail";
import { resolveAuth2Config } from "./config";
import { readRules } from "./rules";

const MAX_PER_HOUR = 20;

export type LockAlert = { email: string | null; failures: number; minutes: number; at: Date };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Sends the alert if an address is set, mail is set up and the hour's limit allows. Answers what happened. */
export async function sendLockAlert(db: Pool, a: LockAlert): Promise<"sent" | "overflow" | "held" | "off"> {
  try {
    const to = (await readRules(db)).notifyLockAlertsTo;
    if (!to) return "off";
    const mail = await getMailSender({ timeoutMs: 10_000 });
    if (!mail.configured) return "off";
    // Claim a place in the hour's allowance in one statement, so parallel locks cannot all slip through.
    const c = await db.connect();
    let kind: "sent" | "overflow" | "held";
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.lock_alerts'))");
      await c.query("DELETE FROM auth2_lock_alerts WHERE sent_at < now() - interval '1 day'");
      const r = await c.query<{ n: number; over: boolean }>("SELECT count(*)::int AS n, bool_or(overflow) AS over FROM auth2_lock_alerts WHERE sent_at > now() - interval '1 hour'");
      const { n, over } = r.rows[0]!;
      kind = n < MAX_PER_HOUR ? "sent" : over ? "held" : "overflow";
      if (kind !== "held") await c.query("INSERT INTO auth2_lock_alerts (overflow) VALUES ($1)", [kind === "overflow"]);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
    if (kind === "held") return kind;
    const base = ((await resolveAuth2Config(db)).baseURL ?? "").replace(/\/+$/, "");
    const users = `${base}/admin?tab=users`;
    const audit = `${base}/admin?tab=audit`;
    if (kind === "overflow") {
      const text = `More accounts are being locked after failed sign-ins on Concept to Realization than one alert an hour each can cover (${MAX_PER_HOUR} alerts sent in the last hour). More locks are happening; see the audit log: ${audit}\n\nNo more alerts are sent until an hour has passed.`;
      await mail.sender.send({ to, subject: "More sign-in locks are happening on Concept to Realization", text, html: `<p>${escapeHtml(text.split("\n")[0]!)}</p><p><a href="${escapeHtml(audit)}">Open the audit log</a></p><p>No more alerts are sent until an hour has passed.</p>` });
      return kind;
    }
    const who = a.email ?? "an address with no account";
    const how = a.minutes === 0 ? "until an administrator unlocks it" : `for ${a.minutes} minutes`;
    const lines = [
      `Account locked: ${who}`,
      `When: ${a.at.toISOString().replace("T", " ").slice(0, 16)} UTC`,
      `Failed sign-ins in a row: ${a.failures}`,
      `Locked ${how}. A password reset by email or Unlock in Admin, Users lifts it at once.`,
    ];
    const text = [`An address was locked after failed sign-ins on Concept to Realization.`, "", ...lines, "", `Open Admin, Users: ${users}`].join("\n");
    await mail.sender.send({
      to,
      subject: `Sign-in locked: ${who}`,
      text,
      html: `<p>An address was locked after failed sign-ins on Concept to Realization.</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p><a href="${escapeHtml(users)}">Open Admin, Users</a></p>`,
    });
    return kind;
  } catch (e) {
    console.warn(`[auth2] the lock alert was not sent: ${(e as Error)?.name ?? "error"}`);
    return "off";
  }
}
