// Platform administration (owner's ruling of 22 Nov): src/lib/auth2/adminOps.ts, each function called as the
// next agent's admin area will call it, with the real database and sign-in instance; effects are checked through
// the real route. Includes the last-administrator race.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { adminOps } from "@/lib/auth2/adminOps";
import { requirePlatformAdmin, NotPlatformAdmin } from "@/lib/auth2/platformAdmin";
import { addMember, auditOf, authenticatorCode, browser, cleanUp, email, newAccount, PASSWORD, sent, useAuth2, waitForMail } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let auth: Awaited<ReturnType<typeof useAuth2>>["auth"];
const BASE = "http://localhost:3322";

beforeAll(async () => {
  ({ db, route, auth } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
});
afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

/** Mail from the operations goes where the sign-in instance's goes in these tests: the captured list. */
const capture = async () => ({ send: async (m: (typeof sent)[number]) => void sent.push(m) });

async function anAdmin(tag: string) {
  const a = await newAccount(route, tag);
  await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [a.userId]);
  // Each administrator confirms changes to other administrators with their own password (step-up).
  return { ...a, ops: adminOps({ db, auth, actorId: a.userId, baseURL: BASE, stepUp: PASSWORD, mailer: capture }), bare: adminOps({ db, auth, actorId: a.userId, baseURL: BASE, mailer: capture }) };
}
const signIn = (who: string, password = PASSWORD) => browser(route).post<{ code?: string; twoFactorRedirect?: boolean }>("/sign-in/email", { email: who, password });
const sessions = async (userId: string) => (await db.query('SELECT 1 FROM "session" WHERE "userId" = $1', [userId])).rowCount;
const flags = async (userId: string) =>
  (await db.query<{ platformAdmin: boolean; disabledAt: Date | null; emailVerified: boolean; twoFactorEnabled: boolean | null; twoFactorRequired: boolean }>('SELECT "platformAdmin", "disabledAt", "emailVerified", "twoFactorEnabled", "twoFactorRequired" FROM "user" WHERE id = $1', [userId])).rows[0];

describe("only a platform administrator", () => {
  it("every operation refuses anyone else, and requirePlatformAdmin answers 401 / 403", async () => {
    const plain = await newAccount(route, "ops-plain");
    const ops = adminOps({ db, auth, actorId: plain.userId, baseURL: BASE });
    await expect(ops.listUsers()).rejects.toMatchObject({ body: { code: "NOT_PLATFORM_ADMIN" } });
    await expect(ops.setPlatformAdmin(plain.userId, true)).rejects.toMatchObject({ body: { code: "NOT_PLATFORM_ADMIN" } });
    expect((await flags(plain.userId)).platformAdmin).toBe(false);
    const h = (b: { cookieHeader: () => string }) => new Headers({ cookie: b.cookieHeader() });
    await expect(requirePlatformAdmin(new Headers())).rejects.toBeInstanceOf(NotPlatformAdmin);
    await expect(requirePlatformAdmin(h(plain.b))).rejects.toMatchObject({ status: 403 });
    const adm = await anAdmin("ops-req");
    expect((await requirePlatformAdmin(h(adm.b))).user.id).toBe(adm.userId);
    // A disabled administrator is no administrator.
    await db.query('UPDATE "user" SET "disabledAt" = now() WHERE id = $1', [adm.userId]);
    await expect(adm.ops.listUsers()).rejects.toMatchObject({ body: { code: "NOT_PLATFORM_ADMIN" } });
  });
});

describe("accounts", () => {
  it("creates an account with a password (can sign in) or without one, confirmed or not; lists it with its state", async () => {
    const adm = await anAdmin("ops-create");
    const withPw = email("made-pw");
    const { id } = await adm.ops.createUser({ email: withPw, name: "Made Pw", password: "Made password 1!", confirmed: true });
    // A temporary password: no session until the person chooses their own (owner's ruling of 23 Nov).
    const first = await signIn(withPw, "Made password 1!");
    expect([first.status, first.body.code]).toEqual([403, "PASSWORD_CHANGE_REQUIRED"]);
    expect((await browser(route).post("/account/first-password", { email: withPw, password: "Made password 1!", newPassword: "My own password 2!" })).status).toBe(200);
    expect((await signIn(withPw, "My own password 2!")).status).toBe(200);
    const without = email("made-nopw");
    const r2 = await adm.ops.createUser({ email: without, name: "No Pw" });
    expect((await signIn(without, "anything at all")).status).toBe(401);
    await expect(adm.ops.createUser({ email: withPw, name: "Again" })).rejects.toMatchObject({ body: { code: "USER_EXISTS" } });
    const list = (await adm.ops.listUsers()).users;
    expect(list.find((u) => u.id === id)).toMatchObject({ confirmed: true, platformAdmin: false, disabled: false, workspaces: 1 });
    expect(list.find((u) => u.id === r2.id)?.confirmed).toBe(false);
    const line = (await auditOf(db, adm.email)).find((l) => l.action === "platform.user_created");
    expect(line?.summary).toContain(withPw);
    expect(JSON.stringify(await db.query("SELECT * FROM audit_log WHERE actor = $1", [adm.email]))).not.toContain("Made password 1!");
  });

  it("confirms an address without sending mail", async () => {
    const adm = await anAdmin("ops-confirm");
    const who = email("unconfirmed");
    await browser(route).post("/sign-up/email", { name: "Unconfirmed", email: who, password: PASSWORD });
    const id = (await db.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [who])).rows[0].id;
    expect((await signIn(who)).status).toBe(403);
    const before = sent.length;
    await adm.ops.confirmEmail(id);
    expect(sent.length).toBe(before);
    expect((await signIn(who)).status).toBe(200);
  });

  it("sets a temporary password, ends that account's sessions, and the person must change it before a session starts", async () => {
    const adm = await anAdmin("ops-pw");
    const t = await newAccount(route, "ops-pw-target");
    expect(await sessions(t.userId)).toBe(1);
    await adm.ops.setPassword(t.userId, "Brand new password 1!");
    expect(await sessions(t.userId)).toBe(0);
    expect((await signIn(t.email)).status).toBe(401);
    expect((await signIn(t.email, "Brand new password 1!")).body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(await sessions(t.userId)).toBe(0);
    // the same temporary password again is refused; a wrong one counts as a failed sign-in
    expect((await browser(route).post("/account/first-password", { email: t.email, password: "Brand new password 1!", newPassword: "Brand new password 1!" })).body.code).toBe("PASSWORD_RULE");
    expect((await browser(route).post("/account/first-password", { email: t.email, password: "not it", newPassword: "Mine at last 3!" })).status).toBe(401);
    expect((await browser(route).post("/account/first-password", { email: t.email, password: "Brand new password 1!", newPassword: "Mine at last 3!" })).status).toBe(200);
    expect((await signIn(t.email, "Mine at last 3!")).status).toBe(200);
    await expect(adm.ops.setPassword(t.userId, "short")).rejects.toMatchObject({ body: { code: "PASSWORD_RULE" } });
  });

  it("requires, resets and turns off two-factor", async () => {
    const adm = await anAdmin("ops-2fa");
    const t = await newAccount(route, "ops-2fa-target");
    const { owed } = await import("@/lib/auth2/workspaces/twoFactor");
    await adm.ops.setTwoFactorRequired(t.userId, true);
    expect(await owed(db, t.userId)).toBe(true);
    const en = await t.b.post<{ totpURI: string }>("/two-factor/enable", { password: PASSWORD });
    await t.b.post("/two-factor/verify-totp", { code: authenticatorCode(en.body.totpURI) });
    expect((await t.b.post<{ code: string }>("/two-factor/disable", { password: PASSWORD })).body.code).toBe("TWO_FACTOR_REQUIRED_BY_WORKSPACE");
    await adm.ops.resetTwoFactor(t.userId);
    expect((await db.query('SELECT 1 FROM "twoFactor" WHERE "userId" = $1', [t.userId])).rowCount).toBe(0);
    expect(await sessions(t.userId)).toBe(0);
    expect(await owed(db, t.userId)).toBe(true);
    await adm.ops.disableTwoFactor(t.userId);
    expect(await owed(db, t.userId)).toBe(false);
    expect((await flags(t.userId)).twoFactorRequired).toBe(false);
  });

  it("a disabled account cannot sign in and its sessions end; enabled again, it can", async () => {
    const adm = await anAdmin("ops-dis");
    const t = await newAccount(route, "ops-dis-target");
    await adm.ops.setDisabled(t.userId, true);
    expect(await sessions(t.userId)).toBe(0);
    expect((await t.b.get("/get-session")).body).toBeNull();
    const res = await signIn(t.email);
    expect([res.status, res.body.code]).toEqual([403, "ACCOUNT_DISABLED"]);
    // A wrong password says what it always says: nothing about the account being disabled.
    expect((await signIn(t.email, "wrong password")).status).toBe(401);
    await adm.ops.setDisabled(t.userId, false);
    expect((await signIn(t.email)).status).toBe(200);
  });
});

describe("the last platform administrator", () => {
  it("can neither lose the flag, be disabled nor be deleted", async () => {
    await db.query('UPDATE "user" SET "platformAdmin" = false');
    const adm = await anAdmin("ops-last");
    await expect(adm.ops.setPlatformAdmin(adm.userId, false)).rejects.toMatchObject({ body: { code: "LAST_PLATFORM_ADMIN" } });
    // and nobody may disable or delete themselves, the last one least of all (owner's rule of 23 Nov)
    await expect(adm.ops.setDisabled(adm.userId, true)).rejects.toMatchObject({ body: { code: "NOT_YOURSELF" } });
    await expect(adm.ops.deleteUser(adm.userId, { deleteWorkspaces: true })).rejects.toMatchObject({ body: { code: "NOT_YOURSELF" } });
    // nor be left owing a proof after a reset of their two-step sign-in
    await expect(adm.ops.resetTwoFactor(adm.userId)).rejects.toMatchObject({ body: { code: "LAST_PLATFORM_ADMIN" } });

    expect((await flags(adm.userId)).platformAdmin).toBe(true);
  });

  it("two administrators removing each other at once leave one", async () => {
    await db.query('UPDATE "user" SET "platformAdmin" = false');
    const a = await anAdmin("ops-race-a");
    const b = await anAdmin("ops-race-b");
    const results = await Promise.allSettled([a.ops.setPlatformAdmin(b.userId, false), b.ops.setPlatformAdmin(a.userId, false)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.query('SELECT 1 FROM "user" WHERE "platformAdmin"')).rowCount).toBe(1);
  });

  it("an administrator can make another one, who can then act", async () => {
    const a = await anAdmin("ops-grant");
    const t = await newAccount(route, "ops-grant-target");
    await a.ops.setPlatformAdmin(t.userId, true);
    const tOps = adminOps({ db, auth, actorId: t.userId, baseURL: BASE });
    expect(Array.isArray((await tOps.listUsers()).users)).toBe(true);
    expect((await auditOf(db, a.email)).map((l) => l.action)).toContain("platform.admin_granted");
  });
});

describe("deleting an account", () => {
  it("is refused while it solely owns a workspace others use, unless transferred or deleted in the same call", async () => {
    const adm = await anAdmin("ops-del");
    const t = await newAccount(route, "ops-del-target");
    const other = await newAccount(route, "ops-del-other");
    const shared = await adminOps({ db, auth, actorId: adm.userId, baseURL: BASE }).createOrganization("Shared bench", t.userId);
    await addMember(db, shared.id, other.userId, "member");
    await expect(adm.ops.deleteUser(t.userId)).rejects.toMatchObject({ body: { code: "SOLE_OWNER" } });
    await expect(adm.ops.deleteUser(t.userId, { transfer: { [shared.id]: adm.userId } })).rejects.toMatchObject({ body: { code: "TRANSFER_NOT_A_MEMBER" } });
    await adm.ops.deleteUser(t.userId, { transfer: { [shared.id]: other.userId } });
    expect((await db.query('SELECT 1 FROM "user" WHERE id = $1', [t.userId])).rowCount).toBe(0);
    // The personal workspace with nobody else in it went with the account; the shared one stayed, with a new owner.
    expect((await db.query("SELECT 1 FROM organization WHERE id = $1", [t.workspaceId])).rowCount).toBe(0);
    expect((await db.query<{ role: string }>('SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2', [shared.id, other.userId])).rows[0].role).toBe("owner");
  });

  it("with deleteWorkspaces, the workspaces only it owned go too, and nobody is left without one", async () => {
    const adm = await anAdmin("ops-del2");
    const t = await newAccount(route, "ops-del2-target");
    const other = await newAccount(route, "ops-del2-other");
    await addMember(db, t.workspaceId, other.userId, "member");
    await db.query("DELETE FROM organization WHERE id = $1", [other.workspaceId]);
    await adm.ops.deleteUser(t.userId, { deleteWorkspaces: true });
    expect((await db.query("SELECT 1 FROM organization WHERE id = $1", [t.workspaceId])).rowCount).toBe(0);
    expect((await db.query('SELECT 1 FROM member WHERE "userId" = $1', [other.userId])).rowCount).toBe(1);
    expect((await auditOf(db, adm.email)).find((l) => l.action === "platform.user_deleted")?.summary).toContain(t.email);
  });
});

describe("workspaces", () => {
  it("creates one with a named owner, renames, sets the policy, adds and removes members, changes roles, deletes", async () => {
    const adm = await anAdmin("ops-org");
    const owner = await newAccount(route, "ops-org-owner");
    const joiner = await newAccount(route, "ops-org-joiner");
    const { id } = await adm.ops.createOrganization("Admin made", owner.userId);
    expect((await db.query<{ role: string }>('SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2', [id, owner.userId])).rows[0].role).toBe("owner");
    await adm.ops.renameOrganization(id, "Admin renamed");
    expect((await db.query<{ name: string }>("SELECT name FROM organization WHERE id = $1", [id])).rows[0].name).toBe("Admin renamed");
    await adm.ops.setOrganizationTwoFactor(id, true);
    expect((await db.query<{ r: boolean }>("SELECT two_factor_required AS r FROM auth2_workspace_policy WHERE organization_id = $1", [id])).rows[0].r).toBe(true);
    const before = sent.length;
    const { memberId } = await adm.ops.addMember(id, joiner.userId, "member");
    expect(sent.length).toBe(before);
    await expect(adm.ops.addMember(id, joiner.userId, "member")).rejects.toMatchObject({ body: { code: "ALREADY_MEMBER" } });
    await adm.ops.changeMemberRole(id, memberId, "admin");
    const ownerMember = (await db.query<{ id: string }>('SELECT id FROM member WHERE "organizationId" = $1 AND "userId" = $2', [id, owner.userId])).rows[0].id;
    await expect(adm.ops.changeMemberRole(id, ownerMember, "member")).rejects.toMatchObject({ body: { code: "LAST_OWNER" } });
    await adm.ops.removeMember(id, memberId);
    await adm.ops.deleteOrganization(id);
    expect((await db.query("SELECT 1 FROM organization WHERE id = $1", [id])).rowCount).toBe(0);
    const actions = (await auditOf(db, adm.email)).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["workspace.created", "workspace.renamed", "platform.two_factor_policy", "platform.member_added", "workspace.role_changed", "workspace.member_removed", "workspace.deleted"]));
  });

  it("makes an invitation and hands its one-time link to the administrator; only a hash is stored", async () => {
    const adm = await anAdmin("ops-inv");
    const owner = await newAccount(route, "ops-inv-owner");
    const to = email("ops-invitee");
    const before = sent.length;
    const { invitationId, link } = await adm.ops.createInvitation(owner.workspaceId, to, "member");
    expect(sent.length).toBe(before);
    expect(link).toMatch(/^http:\/\/localhost:3322\/auth\/invite\?token=/);
    const token = new URL(link).searchParams.get("token")!;
    const stored = JSON.stringify((await db.query("SELECT * FROM auth2_invitation_tokens WHERE invitation_id = $1", [invitationId])).rows);
    expect(stored).not.toContain(token);
    expect(JSON.stringify(await db.query("SELECT * FROM audit_log WHERE actor = $1", [adm.email]))).not.toContain(token);
    const invitee = await newAccount(route, "ops-invitee", to);
    expect((await invitee.b.post("/workspace/invitation/accept", { token })).status).toBe(200);
    expect((await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token })).body.code).toBe("INVITATION_INVALID");
  });
});

describe("F7: the actor is checked again inside the transaction", () => {
  it("an administrator unflagged while their change waits on a lock does not make it (the reviewer's interleaving)", async () => {
    const c0 = await anAdmin("ops-stale");
    const t = await newAccount(route, "ops-stale-target");
    const hold = await db.connect();
    try {
      await hold.query("BEGIN");
      await hold.query('SELECT 1 FROM "user" WHERE "platformAdmin" FOR UPDATE');
      const pending = c0.ops.setPlatformAdmin(t.userId, true).then(() => "ok", (e: { body?: { code?: string } }) => e.body?.code);
      await new Promise((r) => setTimeout(r, 400));
      await hold.query('UPDATE "user" SET "platformAdmin" = false WHERE id = $1', [c0.userId]);
      await hold.query("COMMIT");
      expect(await pending).toBe("NOT_PLATFORM_ADMIN");
    } finally {
      hold.release();
    }
    expect((await flags(t.userId)).platformAdmin).toBe(false);
  });

  it("the same for a change that takes no administrator lock (a password)", async () => {
    const c0 = await anAdmin("ops-stale2");
    const t = await newAccount(route, "ops-stale2-target");
    const hold = await db.connect();
    try {
      await hold.query("BEGIN");
      await hold.query('SELECT 1 FROM "user" WHERE id = $1 FOR UPDATE', [c0.userId]);
      const pending = c0.ops.setPassword(t.userId, "Stale new password 1!").then(() => "ok", (e: { body?: { code?: string } }) => e.body?.code);
      await new Promise((r) => setTimeout(r, 400));
      await hold.query('UPDATE "user" SET "disabledAt" = now() WHERE id = $1', [c0.userId]);
      await hold.query("COMMIT");
      expect(await pending).toBe("NOT_PLATFORM_ADMIN");
    } finally {
      hold.release();
    }
    expect((await signIn(t.email)).status).toBe(200);
  });

  it("N11: a disabled administrator does not count, and may lose the flag while an enabled one remains", async () => {
    await db.query('UPDATE "user" SET "platformAdmin" = false');
    const a = await anAdmin("ops-n11");
    const d = await anAdmin("ops-n11-disabled");
    await db.query('UPDATE "user" SET "disabledAt" = now() WHERE id = $1', [d.userId]);
    await a.ops.setPlatformAdmin(d.userId, false);
    expect((await flags(d.userId)).platformAdmin).toBe(false);
    // The one enabled administrator still cannot go.
    await expect(a.ops.setPlatformAdmin(a.userId, false)).rejects.toMatchObject({ body: { code: "LAST_PLATFORM_ADMIN" } });
  });
});

describe("N14: no password reset for a disabled account", () => {
  it("the request answers as for any address, and no link is sent", async () => {
    const adm = await anAdmin("ops-n14");
    const t = await newAccount(route, "ops-n14-target");
    await adm.ops.setDisabled(t.userId, true);
    const before = sent.length;
    const res = await browser(route).post("/request-password-reset", { email: t.email, redirectTo: "/auth/reset/new" });
    const other = await browser(route).post("/request-password-reset", { email: "nobody-n14@zz-auth2.test", redirectTo: "/auth/reset/new" });
    expect(res.status).toBe(other.status);
    expect(res.body).toEqual(other.body);
    await new Promise((r) => setTimeout(r, 300));
    expect(sent.slice(before).filter((m) => m.to === t.email)).toHaveLength(0);
  });
});


describe("users tab operations (owner's ruling of 23 Nov)", () => {
  it("step-up: a change to another administrator, or making one, needs the actor's own password; a wrong one counts as a failed sign-in", async () => {
    const a = await anAdmin("su-a");
    const b = await anAdmin("su-b");
    const plain = await newAccount(route, "su-plain");
    await expect(a.bare.setDisabled(b.userId, true)).rejects.toMatchObject({ body: { code: "STEP_UP_REQUIRED" } });
    await expect(a.bare.setPlatformAdmin(plain.userId, true)).rejects.toMatchObject({ body: { code: "STEP_UP_REQUIRED" } });
    const wrong = adminOps({ db, auth, actorId: a.userId, baseURL: BASE, stepUp: "not my password" });
    await expect(wrong.updateName(b.userId, "Renamed")).rejects.toMatchObject({ body: { code: "STEP_UP_WRONG" } });
    const w = await db.query<{ failures: number }>("SELECT failures FROM auth2_sign_in_waits WHERE client = '' AND name_key = $1", [(await import("@/lib/auth2/signInWait")).nameKey(a.email)]);
    expect(w.rows[0]?.failures).toBe(1);
    // no step-up for an ordinary account or for oneself
    await a.bare.updateName(plain.userId, "Plain Renamed");
    await a.bare.updateName(a.userId, "Myself");
    await a.ops.setDisabled(b.userId, true);
    expect((await flags(b.userId)).disabledAt).not.toBeNull();
  });

  it("list: search, role and state filters, paging, and the states shown", async () => {
    const adm = await anAdmin("ul-admin");
    const tag = `ul${Date.now().toString(36)}`;
    const one = await adm.ops.createUser({ email: email(`${tag}-inv`), name: `${tag} Invited`, invite: true });
    const two = await adm.ops.createUser({ email: email(`${tag}-tmp`), name: `${tag} Temp`, password: "Temporary pass 1!", confirmed: true });
    await adm.ops.setDisabled(two.id, true);
    const found = await adm.ops.listUsers({ q: tag });
    expect(found.total).toBe(2);
    expect(found.users.find((u) => u.id === one.id)).toMatchObject({ state: "invited", hasPassword: false, invitation: { status: "pending" } });
    expect(found.users.find((u) => u.id === two.id)).toMatchObject({ state: "disabled", mustChangePassword: true, hasPassword: true });
    expect((await adm.ops.listUsers({ q: tag, state: "invited" })).users.map((u) => u.id)).toEqual([one.id]);
    expect((await adm.ops.listUsers({ q: tag, state: "disabled" })).users.map((u) => u.id)).toEqual([two.id]);
    expect((await adm.ops.listUsers({ q: tag, role: "admin" })).total).toBe(0);
    const p1 = await adm.ops.listUsers({ q: tag, pageSize: 1, page: 1 });
    const p2 = await adm.ops.listUsers({ q: tag, pageSize: 1, page: 2 });
    expect([p1.users.length, p2.users.length, p1.users[0]!.id === p2.users[0]!.id]).toEqual([1, 1, false]);
    // LIKE wildcards in the search are taken literally
    expect((await adm.ops.listUsers({ q: "%" })).total).toBe(0);
  });

  it("edit name and email: audited with before and after; a new address must be confirmed unless marked; sessions end", async () => {
    const adm = await anAdmin("ue-admin");
    const t = await newAccount(route, "ue-target");
    await adm.ops.updateName(t.userId, "New Name");
    const to = email("ue-new");
    const before = sent.length;
    expect(await adm.ops.changeEmail(t.userId, to)).toEqual({ confirmationSent: true });
    expect(sent.slice(before).some((m) => m.to === to && /^Confirm your email address/.test(m.subject))).toBe(true);
    expect(await sessions(t.userId)).toBe(0);
    expect((await flags(t.userId)).emailVerified).toBe(false);
    const to2 = email("ue-new2");
    await adm.ops.changeEmail(t.userId, to2, { markVerified: true });
    expect((await flags(t.userId)).emailVerified).toBe(true);
    expect((await signIn(to2)).status).toBe(200);
    const lines = await auditOf(db, adm.email);
    expect(lines.find((l) => l.action === "platform.user_renamed")?.summary).toContain('to "New Name"');
    expect(lines.filter((l) => l.action === "platform.email_changed").map((l) => l.summary).join(" ")).toContain(to2);
  });

  it("end all sessions, require two-step at next sign-in, and a reset link by email", async () => {
    const adm = await anAdmin("us-admin");
    const t = await newAccount(route, "us-target");
    expect(await adm.ops.endAllSessions(t.userId)).toEqual({ ended: 1 });
    await adm.ops.setTwoFactorRequired(t.userId, true);
    expect((await flags(t.userId)).twoFactorRequired).toBe(true);
    expect(await adm.ops.sendResetLink(t.userId)).toEqual({ sent: true });
    await waitForMail("reset-password", t.email, 1);
  });
});
