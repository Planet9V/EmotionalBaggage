// Members and the two-factor requirement (accounts slice 2, steps 3 and 4) through the real route: what each role
// sees, the workspace policy and the per-member flag, enrolment before reaching a workspace, no turning it off while
// required, and the audited reset for a lost phone. Includes isolation between workspaces.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { MembersView } from "@/lib/auth2/workspaces/view";
import { addMember, auditOf, authenticatorCode, browser, cleanUp, forgetLastCode, newAccount, PASSWORD, sent, useAuth2, type Browser } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
});

afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

async function team(tag: string) {
  const owner = await newAccount(route, `${tag}-owner`);
  const admin = await newAccount(route, `${tag}-admin`);
  const member = await newAccount(route, `${tag}-member`);
  const ws = owner.workspaceId;
  const adminId = await addMember(db, ws, admin.userId, "admin");
  const memberId = await addMember(db, ws, member.userId, "member");
  const ownerId = (await db.query<{ id: string }>('SELECT id FROM member WHERE "organizationId" = $1 AND "userId" = $2', [ws, owner.userId])).rows[0].id;
  return { owner, admin, member, ws, ownerId, adminId, memberId };
}

/** Sets up an authenticator app on a signed-in browser; answers the otpauth address. */
async function enrol(b: Browser) {
  const en = await b.post<{ totpURI: string }>("/two-factor/enable", { password: PASSWORD });
  expect(en.status).toBe(200);
  expect((await b.post("/two-factor/verify-totp", { code: authenticatorCode(en.body.totpURI) })).status).toBe(200);
  return en.body.totpURI;
}

const members = (b: Browser, ws: string) => b.get<MembersView & { code?: string }>(`/workspace/members?workspaceId=${encodeURIComponent(ws)}`);

describe("the members screen's data", () => {
  it("an owner or admin sees roles, two-factor state, requirements and invitations", async () => {
    const t = await team("see");
    await t.owner.b.post("/workspace/invite", { workspaceId: t.ws, email: "pending-see@zz-auth2.test", role: "member" });
    const v = (await members(t.admin.b, t.ws)).body;
    expect(v.workspace).toMatchObject({ id: t.ws, role: "admin" });
    expect(v.members.map((m) => m.role)).toEqual(["owner", "admin", "member"]);
    expect(v.members.every((m) => typeof m.twoFactor === "boolean")).toBe(true);
    expect(v.members.find((m) => m.you)?.memberId).toBe(t.adminId);
    // An admin manages the member but not the owner, and not themself.
    expect(Object.fromEntries(v.members.map((m) => [m.role, m.manageable]))).toEqual({ owner: false, admin: false, member: true });
    expect(v.admin?.invitations.map((i) => i.email)).toEqual(["pending-see@zz-auth2.test"]);
    expect(v.admin?.twoFactorRequired).toBe(false);
  });

  it("a member sees who is there and their roles, and nothing more", async () => {
    const t = await team("plainsee");
    const v = (await members(t.member.b, t.ws)).body;
    expect(v.members).toHaveLength(3);
    expect(v.admin).toBeUndefined();
    for (const m of v.members) {
      expect(m.twoFactor).toBeUndefined();
      expect(m.required).toBeUndefined();
    }
  });

  it("someone from another workspace gets not-found", async () => {
    const t = await team("seeiso");
    const other = await newAccount(route, "seeiso-out");
    const res = await members(other.b, t.ws);
    expect([res.status, res.body.code]).toEqual([404, "WORKSPACE_NOT_FOUND"]);
  });
});

describe("the workspace policy", () => {
  it("a member cannot change it; an owner or admin can, and it is audited", async () => {
    const t = await team("pol");
    expect((await t.member.b.post<{ code: string }>("/workspace/two-factor-policy", { workspaceId: t.ws, required: true })).body.code).toBe("NOT_ALLOWED");
    const outsider = await newAccount(route, "pol-out");
    expect((await outsider.b.post<{ code: string }>("/workspace/two-factor-policy", { workspaceId: t.ws, required: true })).body.code).toBe("WORKSPACE_NOT_FOUND");
    await enrol(t.admin.b);
    expect((await t.admin.b.post("/workspace/two-factor-policy", { workspaceId: t.ws, required: true })).status).toBe(200);
    expect((await members(t.admin.b, t.ws)).body.admin?.twoFactorRequired).toBe(true);
    expect((await auditOf(db, t.admin.email)).map((l) => l.action)).toContain("workspace.two_factor_policy");
  });

  it("a person not yet enrolled is sent to enrolment after the password and reaches no workspace until then", async () => {
    const t = await team("enf");
    await db.query("INSERT INTO auth2_workspace_policy (organization_id, two_factor_required) VALUES ($1, true)", [t.ws]);
    // Signing in with the password works (one step: no app yet)...
    const b = browser(route);
    expect((await b.post("/sign-in/email", { email: t.member.email, password: PASSWORD })).status).toBe(200);
    // ...but every workspace, their own included, is closed.
    for (const res of [await b.get<{ code: string }>("/workspace/list"), await members(b, t.ws), await members(b, t.member.workspaceId)]) {
      expect([res.status, res.body.code]).toEqual([403, "TWO_FACTOR_SETUP_REQUIRED"]);
    }
    expect((await b.post<{ code: string }>("/workspace/set-active", { workspaceId: t.member.workspaceId })).body.code).toBe("TWO_FACTOR_SETUP_REQUIRED");
    const { owed } = await import("@/lib/auth2/workspaces/twoFactor");
    expect(await owed(db, t.member.userId)).toBe(true);
    await enrol(b);
    expect(await owed(db, t.member.userId)).toBe(false);
    expect((await b.get("/workspace/list")).status).toBe(200);
  });

  it("while required, two-factor cannot be turned off; once no longer required, it can", async () => {
    const t = await team("off");
    await enrol(t.member.b);
    await db.query("INSERT INTO auth2_workspace_policy (organization_id, two_factor_required) VALUES ($1, true)", [t.ws]);
    const res = await t.member.b.post<{ code: string }>("/two-factor/disable", { password: PASSWORD });
    expect([res.status, res.body.code]).toEqual([403, "TWO_FACTOR_REQUIRED_BY_WORKSPACE"]);
    expect((await db.query<{ e: boolean }>('SELECT "twoFactorEnabled" AS e FROM "user" WHERE id = $1', [t.member.userId])).rows[0].e).toBe(true);
    await db.query("UPDATE auth2_workspace_policy SET two_factor_required = false WHERE organization_id = $1", [t.ws]);
    expect((await t.member.b.post("/two-factor/disable", { password: PASSWORD })).status).toBe(200);
  });
});

describe("requiring two-factor of one member", () => {
  it("an admin can require it of a member but not of the owner; the member then owes it", async () => {
    const t = await team("flag");
    expect((await t.admin.b.post<{ code: string }>("/workspace/member/two-factor-required", { workspaceId: t.ws, memberId: t.ownerId, required: true })).body.code).toBe("NOT_ALLOWED");
    expect((await t.member.b.post<{ code: string }>("/workspace/member/two-factor-required", { workspaceId: t.ws, memberId: t.adminId, required: true })).body.code).toBe("NOT_ALLOWED");
    expect((await t.admin.b.post("/workspace/member/two-factor-required", { workspaceId: t.ws, memberId: t.memberId, required: true })).status).toBe(200);
    const { owed } = await import("@/lib/auth2/workspaces/twoFactor");
    expect(await owed(db, t.member.userId)).toBe(true);
    expect(await owed(db, t.owner.userId)).toBe(false);
    const row = (await members(t.admin.b, t.ws)).body.members.find((m) => m.memberId === t.memberId);
    expect(row?.required).toBe(true);
    expect((await auditOf(db, t.admin.email)).map((l) => l.action)).toContain("workspace.member_two_factor_required");
  });

  it("a member id of another workspace is not found", async () => {
    const a = await team("flagA");
    const b = await team("flagB");
    const res = await a.owner.b.post<{ code: string }>("/workspace/member/two-factor-required", { workspaceId: a.ws, memberId: b.memberId, required: true });
    expect([res.status, res.body.code]).toEqual([404, "MEMBER_NOT_FOUND"]);
  });
});

describe("resetting a member's two-factor (lost phone)", () => {
  it("removes the app and recovery codes, ends their sessions, emails a link, and is audited; the password alone no longer signs in (B4)", async () => {
    const t = await team("reset");
    await t.admin.b.post("/workspace/member/two-factor-required", { workspaceId: t.ws, memberId: t.memberId, required: true });
    await enrol(t.member.b);
    const before = sent.length;
    const res = await t.admin.b.post<{ code?: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.memberId });
    expect(res.status).toBe(200);
    expect(res.body.code).toBeUndefined();
    expect((await db.query('SELECT 1 FROM "twoFactor" WHERE "userId" = $1', [t.member.userId])).rowCount).toBe(0);
    expect((await db.query('SELECT 1 FROM "session" WHERE "userId" = $1', [t.member.userId])).rowCount).toBe(0);
    expect((await t.member.b.get("/get-session")).body).toBeNull();
    const notice = sent.slice(before).find((m) => m.to === t.member.email && /two-step sign-in .* was reset/.test(m.subject));
    expect(notice).toBeDefined();
    const link = /https?:\/\/\S+/.exec(notice!.text)![0];
    expect(link).toMatch(/\/auth\/re-enrol\?token=/);
    const token = new URL(link).searchParams.get("token")!;
    expect(JSON.stringify((await db.query("SELECT * FROM auth2_reenrol WHERE user_id = $1", [t.member.userId])).rows)).not.toContain(token);
    const line = (await auditOf(db, t.admin.email)).find((l) => l.action === "workspace.member_two_factor_reset");
    expect(line?.summary).toContain(t.member.email);
    // The password alone starts no session, whoever has it.
    await forgetLastCode(db, t.member.userId);
    const inn = await browser(route).post<{ code: string }>("/sign-in/email", { email: t.member.email, password: PASSWORD });
    expect([inn.status, inn.body.code]).toEqual([403, "REENROL_PROOF_REQUIRED"]);
    // A wrong proof, or the right one with a wrong password: one answer.
    const b = browser(route);
    expect((await b.post<{ code: string }>("/re-enrol", { email: t.member.email, password: PASSWORD, proof: "x".repeat(43) })).body.code).toBe("REENROL_INVALID");
    expect((await b.post<{ code: string }>("/re-enrol", { email: t.member.email, password: "wrong password", proof: token })).body.code).toBe("REENROL_INVALID");
    // The link and the password: signed in, sent to set up the app, which spends the proof.
    expect((await b.post("/re-enrol", { email: t.member.email, password: PASSWORD, proof: token })).status).toBe(200);
    expect((await b.post("/sign-in/email", { email: t.member.email, password: PASSWORD })).status).toBe(200);
    expect((await b.get<{ code: string }>("/workspace/list")).body.code).toBe("TWO_FACTOR_SETUP_REQUIRED");
    await enrol(b);
    expect((await db.query("SELECT 1 FROM auth2_reenrol WHERE user_id = $1", [t.member.userId])).rowCount).toBe(0);
  });

  it("in 'no mail' mode the one who resets gets a one-time code to hand over, which works once with the password", async () => {
    const t = await team("resetnm");
    await db.query("INSERT INTO auth2_workspace_policy (organization_id, two_factor_required) VALUES ($1, true)", [t.ws]);
    await enrol(t.admin.b);
    await enrol(t.member.b);
    const { makeAuth } = await import("@/lib/auth2/auth");
    const g = globalThis as unknown as { __c2rAuth2?: unknown };
    const keep = g.__c2rAuth2;
    g.__c2rAuth2 = { db, auth: makeAuth(db, { mail: null, rateLimit: false }) };
    let code = "";
    try {
      const res = await t.admin.b.post<{ code?: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.memberId });
      code = res.body.code ?? "";
      expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
    } finally {
      g.__c2rAuth2 = keep;
    }
    const b = browser(route);
    expect((await b.post<{ code: string }>("/sign-in/email", { email: t.member.email, password: PASSWORD })).body.code).toBe("REENROL_PROOF_REQUIRED");
    expect((await b.post("/re-enrol", { email: t.member.email, password: PASSWORD, proof: code.toLowerCase() })).status).toBe(200);
    expect((await b.post("/sign-in/email", { email: t.member.email, password: PASSWORD })).status).toBe(200);
  });

  it("B4: a workspace cannot reset an account that matters elsewhere; at most three resets a day", async () => {
    const t = await team("b4");
    await db.query("INSERT INTO auth2_workspace_policy (organization_id, two_factor_required) VALUES ($1, true)", [t.ws]);
    await enrol(t.owner.b);
    await enrol(t.member.b);
    const reset = () => t.owner.b.post<{ code: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.memberId });
    // A platform administrator.
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [t.member.userId]);
    expect((await reset()).body.code).toBe("RESET_NEEDS_PLATFORM_ADMIN");
    await db.query('UPDATE "user" SET "platformAdmin" = false WHERE id = $1', [t.member.userId]);
    // Required by a platform administrator.
    await db.query('UPDATE "user" SET "twoFactorRequired" = true WHERE id = $1', [t.member.userId]);
    expect((await reset()).body.code).toBe("RESET_NEEDS_PLATFORM_ADMIN");
    await db.query('UPDATE "user" SET "twoFactorRequired" = false WHERE id = $1', [t.member.userId]);
    // An owner or admin of another workspace with someone else in it (their own workspace alone does not count).
    const other = await newAccount(route, "b4-other");
    const extra = await addMember(db, t.member.workspaceId, other.userId, "member");
    expect((await reset()).body.code).toBe("RESET_NEEDS_PLATFORM_ADMIN");
    await db.query("DELETE FROM member WHERE id = $1", [extra]);
    // Required by another workspace.
    await db.query("INSERT INTO auth2_workspace_policy (organization_id, two_factor_required) VALUES ($1, true)", [other.workspaceId]);
    const inOther = await addMember(db, other.workspaceId, t.member.userId, "member");
    expect((await reset()).body.code).toBe("RESET_NEEDS_PLATFORM_ADMIN");
    await db.query("DELETE FROM member WHERE id = $1", [inOther]);
    expect((await db.query('SELECT 1 FROM "twoFactor" WHERE "userId" = $1', [t.member.userId])).rowCount).toBe(1);
    // Three a day per person.
    await db.query("INSERT INTO auth2_two_factor_resets (user_id) SELECT $1 FROM generate_series(1, 3)", [t.member.userId]);
    const limited = await reset();
    expect([limited.body.code]).toEqual(["RESET_LIMIT"]);
  });

  it("is refused where this workspace does not require it, for oneself, for someone the actor does not manage, and from outside", async () => {
    const t = await team("noreset");
    await enrol(t.member.b);
    expect((await t.admin.b.post<{ code: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.memberId })).body.code).toBe("TWO_FACTOR_NOT_REQUIRED_HERE");
    await db.query("INSERT INTO auth2_workspace_policy (organization_id, two_factor_required) VALUES ($1, true)", [t.ws]);
    await enrol(t.admin.b);
    await enrol(t.owner.b);
    expect((await t.admin.b.post<{ code: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.adminId })).body.code).toBe("NOT_YOUR_OWN");
    expect((await t.admin.b.post<{ code: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.ownerId })).body.code).toBe("NOT_ALLOWED");
    expect((await t.member.b.post<{ code: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.adminId })).body.code).toBe("NOT_ALLOWED");
    const outsider = await newAccount(route, "noreset-out");
    expect((await outsider.b.post<{ code: string }>("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.memberId })).body.code).toBe("WORKSPACE_NOT_FOUND");
    expect((await db.query('SELECT 1 FROM "twoFactor" WHERE "userId" = $1', [t.member.userId])).rowCount).toBe(1);
    // The owner may reset the admin (whose own workspace has nobody else in it).
    expect((await t.owner.b.post("/workspace/member/reset-two-factor", { workspaceId: t.ws, memberId: t.adminId })).status).toBe(200);
  });
});
