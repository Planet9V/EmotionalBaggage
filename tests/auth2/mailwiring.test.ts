// Item 2 of the admin integration: the new sign-in's mail goes through Admin, Email (src/lib/admin/mail.ts
// getMailSender) when a mail server is set up there, and is in "no mail" mode when not. Against the small SMTP
// stand-in the admin tests use; no real mail is sent.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { smtpStandIn } from "../admin/smtpStandIn";
import { addMember, authenticatorCode, browser, cleanUp, email, newAccount, PASSWORD, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let smtp: Awaited<ReturnType<typeof smtpStandIn>>;
const env = process.env as Record<string, string | undefined>;
const g = globalThis as unknown as { __c2rAuth2?: unknown };
let testInstance: unknown;

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
  testInstance = g.__c2rAuth2;
  await cleanUp(db);
  smtp = await smtpStandIn("unused");
});
afterAll(async () => {
  g.__c2rAuth2 = testInstance;
  await db.query("DELETE FROM settings WHERE key = 'mail.smtp'");
  await cleanUp(db);
  await smtp.close();
  delete process.env.AUTH2;
});

/** The sign-in with no mail sender of its own: it asks currentMailSender(), so Admin, Email, at every message. */
async function realMail() {
  const { makeAuth } = await import("@/lib/auth2/auth");
  g.__c2rAuth2 = { db, auth: makeAuth(db, { rateLimit: false }) };
}
const configureMail = (on: boolean) =>
  on
    ? db.query("INSERT INTO settings (key, value) VALUES ('mail.smtp', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [
        JSON.stringify({ mode: "smtp", fromName: "C2R", fromAddress: "noreply@example.test", host: "127.0.0.1", port: smtp.port, security: "none", username: null }),
      ])
    : db.query("DELETE FROM settings WHERE key = 'mail.smtp'");
const until = async (n: number) => {
  for (let i = 0; i < 100 && smtp.messages.length < n; i++) await new Promise((r) => setTimeout(r, 50));
};
const linkIn = (m: string) => /https?:\/\/\S+/.exec(m.replace(/=\r?\n/g, ""))?.[0].replace(/=3D/g, "=") ?? "";

describe("with Admin, Email set up", () => {
  it("confirmation, reset, invitation and reset-notice mails go to the mail server", async () => {
    // Accounts made with the test's own capturing mailer first, then the real path.
    const owner = await newAccount(route, "mw-owner");
    const member = await newAccount(route, "mw-member");
    await configureMail(true);
    await realMail();
    try {
      const start = smtp.messages.length;
      const who = email("mw-new");
      expect((await browser(route).post("/sign-up/email", { name: "Mail Wire", email: who, password: PASSWORD })).status).toBe(200);
      await until(start + 1);
      expect(smtp.messages.at(-1)).toMatch(/Subject: Confirm your email address/);
      expect(linkIn(smtp.messages.at(-1)!)).toMatch(/\/auth\/confirm\?token=/);

      expect((await browser(route).post("/request-password-reset", { email: member.email, redirectTo: "/auth/reset/new" })).status).toBe(200);
      await until(start + 2);
      expect(smtp.messages.at(-1)).toMatch(/Subject: Choose a new password/);

      const inv = await owner.b.post<{ mailed: boolean; link?: string }>("/workspace/invite", { workspaceId: owner.workspaceId, email: email("mw-invitee"), role: "member" });
      expect(inv.body).toMatchObject({ mailed: true });
      expect(inv.body.link).toBeUndefined();
      await until(start + 3);
      expect(smtp.messages.at(-1)).toMatch(/invited you to/);

      const mid = await addMember(db, owner.workspaceId, member.userId, "member");
      await db.query("INSERT INTO auth2_member_flags (member_id, two_factor_required) VALUES ($1, true)", [mid]);
      const en = await member.b.post<{ totpURI: string }>("/two-factor/enable", { password: PASSWORD });
      await member.b.post("/two-factor/verify-totp", { code: authenticatorCode(en.body.totpURI) });
      expect((await owner.b.post("/workspace/member/reset-two-factor", { workspaceId: owner.workspaceId, memberId: mid })).status).toBe(200);
      await until(start + 4);
      expect(smtp.messages.at(-1)).toMatch(/was reset/);
      expect(linkIn(smtp.messages.at(-1)!)).toMatch(/\/auth\/re-enrol\?token=/);
    } finally {
      g.__c2rAuth2 = testInstance;
    }
  });
});

describe("with nothing set up in Admin, Email (production)", () => {
  it("'no mail' mode: nothing reaches the mail server and the invitation link goes to the inviter", async () => {
    const owner = await newAccount(route, "mw-nomail");
    await configureMail(false);
    await realMail();
    const keep = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const start = smtp.messages.length;
      const inv = await owner.b.post<{ mailed: boolean; link?: string }>("/workspace/invite", { workspaceId: owner.workspaceId, email: email("mw-nm"), role: "member" });
      expect(inv.body.mailed).toBe(false);
      expect(inv.body.link).toMatch(/\/auth\/invite\?token=/);
      expect((await browser(route).post("/sign-up/email", { name: "No Mail", email: email("mw-nm2"), password: PASSWORD })).status).toBe(200);
      await new Promise((r) => setTimeout(r, 300));
      expect(smtp.messages.length).toBe(start);
    } finally {
      env.NODE_ENV = keep;
      g.__c2rAuth2 = testInstance;
    }
  });
});
