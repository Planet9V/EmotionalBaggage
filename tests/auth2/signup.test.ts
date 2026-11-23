// Sign-up requests (owner's ruling of 23 Nov: "request to sign up goes to jim@eigenia.nl"). Self sign-up is closed
// by default during early access: only an address with a workspace invitation waiting creates its account; anyone
// else asks for one, which is an access request and is announced to notify.signupRequestsTo when mail is set up.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { smtpStandIn } from "../admin/smtpStandIn";
import { browser, cleanUp, email, newAccount, PASSWORD, setSignUpOpen, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let smtp: Awaited<ReturnType<typeof smtpStandIn>>;
const BASE = "http://localhost:3322";

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false, signUpOpen: false }));
  await cleanUp(db);
  smtp = await smtpStandIn("unused");
});
afterAll(async () => {
  await db.query("DELETE FROM settings WHERE key = 'mail.smtp'");
  await db.query("DELETE FROM auth2_settings WHERE key IN ('notify.signupRequestsTo', 'signUp.open')");
  await db.query("DELETE FROM access_requests WHERE email LIKE '%@zz-signup.test'");
  await smtp.close();
  await cleanUp(db);
  delete process.env.AUTH2;
});

const mailOn = (on: boolean) =>
  on
    ? db.query("INSERT INTO settings (key, value) VALUES ('mail.smtp', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify({ mode: "smtp", fromName: "C2R", fromAddress: "noreply@example.test", host: "127.0.0.1", port: smtp.port, security: "none", username: null })])
    : db.query("DELETE FROM settings WHERE key = 'mail.smtp'");
const until = async (n: number) => {
  for (let i = 0; i < 100 && smtp.messages.length < n; i++) await new Promise((r) => setTimeout(r, 50));
};
async function requestAccess(body: Record<string, unknown>) {
  // The form's own throttle (five a window from one address) is not what is tested here.
  await db.query("DELETE FROM sign_in_attempts WHERE username_key LIKE ' access-%'");
  const { POST } = await import("@/app/api/access-requests/route");
  return POST(new Request(`${BASE}/api/access-requests`, { method: "POST", headers: { origin: BASE, host: "localhost:3322", "content-type": "application/json" }, body: JSON.stringify(body) }));
}

describe("self sign-up closed (the default)", () => {
  it("refuses an address with no invitation; an invited address signs up; open again in Admin it is as before", async () => {
    const refused = await browser(route).post("/sign-up/email", { name: "Nobody", email: email("closed"), password: PASSWORD });
    expect([refused.status, refused.body.code]).toEqual([403, "SIGN_UP_CLOSED"]);
    // a workspace invitation for the address lets it make its account
    const owner = await (async () => {
      await setSignUpOpen(db, true);
      const o = await newAccount(route, "closed-owner");
      await setSignUpOpen(db, false);
      return o;
    })();
    const invitee = email("closed-invitee");
    const sent = await owner.b.post<{ invitationId: string }>("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee, role: "member" });
    expect(sent.status).toBe(200);
    expect((await browser(route).post("/sign-up/email", { name: "Invitee", email: invitee, password: PASSWORD })).status).toBe(200);
  });
});

describe("the owner hears of every request", () => {
  it("an early-access request and an account request are emailed to the address set (default jim@eigenia.nl), with a link to Admin and no secret", async () => {
    await mailOn(true);
    await db.query("DELETE FROM auth2_settings WHERE key = 'notify.signupRequestsTo'");
    const start = smtp.messages.length;
    const ea = await requestAccess({ email: `ea-${Date.now()}@zz-signup.test`, building: "A luggage tag that talks", name: "Ea", placement: "hero" });
    expect([ea.status, ea.status === 201 ? "" : await ea.text()]).toEqual([201, ""]);
    await until(start + 2); // the requester's confirmation and the owner's notice
    const notice = smtp.messages.slice(start).find((m) => /Subject: New request for early access/.test(m));
    expect(notice).toBeTruthy();
    expect(notice).toMatch(/To: jim@eigenia\.nl/i);
    expect(notice).toMatch(/A luggage tag that talks/);
    expect(notice).toMatch(/\/admin\?tab=access/);
    expect(notice).not.toMatch(/token=/);
    // an account request from the closed sign-up page, to an address the administrator set
    await db.query(`INSERT INTO auth2_settings (key, value) VALUES ('notify.signupRequestsTo', '"owner@example.test"') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    const s2 = smtp.messages.length;
    const acct = `acct-${Date.now()}@zz-signup.test`;
    expect((await requestAccess({ email: acct, building: "A bike light", name: "Acc", placement: "signup" })).status).toBe(201);
    await until(s2 + 2);
    const n2 = smtp.messages.slice(s2).find((m) => /Subject: New request for an account/.test(m));
    expect(n2).toMatch(/To: owner@example\.test/i);
    expect((await db.query("SELECT placement FROM access_requests WHERE email = $1", [acct])).rows[0]?.placement).toBe("signup");
  });

  it("no address set, or no mail: nothing is sent and the request is still listed", async () => {
    await db.query(`INSERT INTO auth2_settings (key, value) VALUES ('notify.signupRequestsTo', '""') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    const start = smtp.messages.length;
    const who = `quiet-${Date.now()}@zz-signup.test`;
    expect((await requestAccess({ email: who, building: "A quiet thing" })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 400));
    expect(smtp.messages.slice(start).some((m) => /New request for/.test(m))).toBe(false);
    expect((await db.query("SELECT 1 FROM access_requests WHERE email = $1", [who])).rowCount).toBe(1);
    await mailOn(false);
  });
});
