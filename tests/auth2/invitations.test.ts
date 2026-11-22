// Invitations (accounts slice 2, step 2) through the real route: hashed single-use links with an expiry, accepting
// with an existing account and as a new person, resend and revoke, who may invite whom, limits, "no mail" mode,
// the throttle on endpoints that send mail, and isolation between workspaces.
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { INVITATIONS_PER_HOUR } from "@/lib/auth2/workspaces/permissions";
import { addMember, auditOf, browser, cleanUp, email, lastMail, newAccount, sent, useAuth2 } from "./helpers";

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

type Sent = { invitationId: string; email: string; role: string; mailed: boolean; link?: string };
const tokenOf = (to: string) => lastMail("invitation", to).token;
const hash = (t: string) => createHash("sha256").update(t).digest("base64url");
const workspacesOf = async (b: { get: <T>(p: string) => Promise<{ body: T }> }) => (await b.get<{ active: string; workspaces: { id: string; role: string }[] }>("/workspace/list")).body;

describe("an invitation link", () => {
  it("is emailed, and only its hash is stored; the invitation's id is not the token", async () => {
    const owner = await newAccount(route, "inv-owner");
    const to = email("inv-new");
    const res = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: to.toUpperCase(), role: "member" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: to, role: "member", mailed: true });
    expect(res.body.link).toBeUndefined();
    const m = lastMail("invitation", to);
    expect(m.link).toMatch(/^http:\/\/localhost:3322\/auth\/invite\?token=/);
    expect(m.subject).toBe(`inv-owner invited you to inv-owner's workspace on Concept to Realization`);
    const stored = await db.query<{ token_hash: string; invitation_id: string }>("SELECT token_hash, invitation_id FROM auth2_invitation_tokens WHERE invitation_id = $1", [res.body.invitationId]);
    expect(stored.rows[0].token_hash).toBe(hash(m.token));
    expect(stored.rows[0].token_hash).not.toContain(m.token);
    expect(res.body.invitationId).not.toBe(m.token);
    const all = JSON.stringify((await db.query("SELECT * FROM invitation WHERE id = $1", [res.body.invitationId])).rows);
    expect(all).not.toContain(m.token);
  });
});

describe("accepting", () => {
  it("with an existing account: joins with the role, moves the session there, and keeps the person's own workspace", async () => {
    const owner = await newAccount(route, "acc-owner");
    const invitee = await newAccount(route, "acc-existing");
    await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee.email, role: "admin" });
    const res = await invitee.b.post<{ workspaceId: string; role: string }>("/workspace/invitation/accept", { token: tokenOf(invitee.email) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ workspaceId: owner.workspaceId, role: "admin" });
    const l = await workspacesOf(invitee.b);
    expect(l.active).toBe(owner.workspaceId);
    expect(l.workspaces.map((w) => [w.id, w.role])).toEqual([[invitee.workspaceId, "owner"], [owner.workspaceId, "admin"]]);
  });

  it("as a new person: sign up with the invited address, confirm, sign in, then accept", async () => {
    const owner = await newAccount(route, "new-owner");
    const to = email("newcomer");
    await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: to, role: "member" });
    const token = tokenOf(to);
    const anon = browser(route);
    expect((await anon.post("/workspace/invitation/accept", { token })).status).toBe(401);
    const newcomer = await newAccount(route, "newcomer", to);
    expect((await newcomer.b.post("/workspace/invitation/accept", { token })).status).toBe(200);
    const l = await workspacesOf(newcomer.b);
    expect(l.workspaces).toHaveLength(2);
    expect(l.workspaces.find((w) => w.id === owner.workspaceId)?.role).toBe("member");
  });

  it("works once: a second use, and two tabs at once, join once", async () => {
    const owner = await newAccount(route, "once-owner");
    const invitee = await newAccount(route, "once-invitee");
    await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee.email, role: "member" });
    const token = tokenOf(invitee.email);
    const [a, b] = await Promise.all([invitee.b.post("/workspace/invitation/accept", { token }), invitee.b.post("/workspace/invitation/accept", { token })]);
    expect([a.status, b.status].sort()).toEqual([200, 404]);
    const again = await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token });
    expect([again.status, again.body.code]).toEqual([404, "INVITATION_INVALID"]);
    const n = await db.query('SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2', [owner.workspaceId, invitee.userId]);
    expect(n.rowCount).toBe(1);
  });

  it("is refused for another signed-in address, and nothing changes", async () => {
    const owner = await newAccount(route, "other-owner");
    const to = email("intended");
    await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: to, role: "member" });
    const someoneElse = await newAccount(route, "someone-else");
    const res = await someoneElse.b.post<{ code: string }>("/workspace/invitation/accept", { token: tokenOf(to) });
    expect([res.status, res.body.code]).toEqual([403, "INVITATION_OTHER_ADDRESS"]);
    expect((await workspacesOf(someoneElse.b)).workspaces).toHaveLength(1);
    // The intended person can still use it.
    const intended = await newAccount(route, "intended", to);
    expect((await intended.b.post("/workspace/invitation/accept", { token: tokenOf(to) })).status).toBe(200);
  });

  it("is refused once expired, and for a made-up token", async () => {
    const owner = await newAccount(route, "exp-owner");
    const invitee = await newAccount(route, "exp-invitee");
    const res = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee.email, role: "member" });
    await db.query(`UPDATE invitation SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [res.body.invitationId]);
    expect((await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token: tokenOf(invitee.email) })).body.code).toBe("INVITATION_EXPIRED");
    expect((await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token: "x".repeat(43) })).body.code).toBe("INVITATION_INVALID");
    // An invitation id is not a token.
    expect((await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token: res.body.invitationId })).status).toBe(404);
  });
});

describe("resend and revoke", () => {
  it("resend makes a new link (the old one stops working), not more than once a minute", async () => {
    const owner = await newAccount(route, "re-owner");
    const invitee = await newAccount(route, "re-invitee");
    const inv = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee.email, role: "member" });
    const first = tokenOf(invitee.email);
    const soon = await owner.b.post<{ code: string }>("/workspace/invitation/resend", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId });
    expect([soon.status, soon.body.code]).toEqual([429, "RESENT_TOO_SOON"]);
    await db.query("UPDATE auth2_invitation_tokens SET sent_at = now() - interval '2 minutes' WHERE invitation_id = $1", [inv.body.invitationId]);
    expect((await owner.b.post("/workspace/invitation/resend", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId })).status).toBe(200);
    const second = tokenOf(invitee.email);
    expect(second).not.toBe(first);
    expect((await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token: first })).body.code).toBe("INVITATION_INVALID");
    expect((await invitee.b.post("/workspace/invitation/accept", { token: second })).status).toBe(200);
  });

  it("an invitation can be sent at most five times", async () => {
    const owner = await newAccount(route, "five-owner");
    const inv = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: email("five"), role: "member" });
    await db.query("UPDATE auth2_invitation_tokens SET send_count = 5, sent_at = now() - interval '2 minutes' WHERE invitation_id = $1", [inv.body.invitationId]);
    const res = await owner.b.post<{ code: string }>("/workspace/invitation/resend", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId });
    expect([res.status, res.body.code]).toEqual([403, "RESEND_LIMIT"]);
  });

  it("revoke ends the link at once", async () => {
    const owner = await newAccount(route, "rev-owner");
    const invitee = await newAccount(route, "rev-invitee");
    const inv = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee.email, role: "member" });
    expect((await owner.b.post("/workspace/invitation/revoke", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId })).status).toBe(200);
    expect((await invitee.b.post<{ code: string }>("/workspace/invitation/accept", { token: tokenOf(invitee.email) })).body.code).toBe("INVITATION_INVALID");
    expect((await owner.b.post<{ code: string }>("/workspace/invitation/revoke", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId })).body.code).toBe("INVITATION_NOT_FOUND");
  });
});

describe("who may invite whom", () => {
  async function team(tag: string) {
    const owner = await newAccount(route, `${tag}-o`);
    const admin = await newAccount(route, `${tag}-a`);
    const member = await newAccount(route, `${tag}-m`);
    await addMember(db, owner.workspaceId, admin.userId, "admin");
    await addMember(db, owner.workspaceId, member.userId, "member");
    return { owner, admin, member, ws: owner.workspaceId };
  }

  it("a member may not invite, resend or revoke", async () => {
    const t = await team("who-m");
    const inv = await t.owner.b.post<Sent>("/workspace/invite", { workspaceId: t.ws, email: email("x"), role: "member" });
    for (const [path, body] of [
      ["/workspace/invite", { workspaceId: t.ws, email: email("y"), role: "member" }],
      ["/workspace/invitation/resend", { workspaceId: t.ws, invitationId: inv.body.invitationId }],
      ["/workspace/invitation/revoke", { workspaceId: t.ws, invitationId: inv.body.invitationId }],
    ] as const) {
      const res = await t.member.b.post<{ code: string }>(path, body);
      expect([res.status, res.body.code], path).toEqual([403, "NOT_ALLOWED"]);
    }
  });

  it("an admin invites members and admins but not owners, and cannot revoke an owner's invitation", async () => {
    const t = await team("who-a");
    expect((await t.admin.b.post("/workspace/invite", { workspaceId: t.ws, email: email("am"), role: "member" })).status).toBe(200);
    expect((await t.admin.b.post("/workspace/invite", { workspaceId: t.ws, email: email("aa"), role: "admin" })).status).toBe(200);
    expect((await t.admin.b.post<{ code: string }>("/workspace/invite", { workspaceId: t.ws, email: email("ao"), role: "owner" })).body.code).toBe("NOT_ALLOWED");
    const ownerInv = await t.owner.b.post<Sent>("/workspace/invite", { workspaceId: t.ws, email: email("oo"), role: "owner" });
    expect(ownerInv.status).toBe(200);
    expect((await t.admin.b.post<{ code: string }>("/workspace/invitation/revoke", { workspaceId: t.ws, invitationId: ownerInv.body.invitationId })).body.code).toBe("NOT_ALLOWED");
  });

  it("an unknown role or a bad address is refused", async () => {
    const t = await team("who-bad");
    expect((await t.owner.b.post<{ code: string }>("/workspace/invite", { workspaceId: t.ws, email: email("r"), role: "root" })).body.code).toBe("INVALID_ROLE");
    expect((await t.owner.b.post<{ code: string }>("/workspace/invite", { workspaceId: t.ws, email: "not an address", role: "member" })).body.code).toBe("INVALID_EMAIL");
  });
});

describe("limits", () => {
  it("a member, or an address already invited, cannot be invited again", async () => {
    const owner = await newAccount(route, "lim-owner");
    const member = await newAccount(route, "lim-member");
    await addMember(db, owner.workspaceId, member.userId, "member");
    expect((await owner.b.post<{ code: string }>("/workspace/invite", { workspaceId: owner.workspaceId, email: member.email, role: "member" })).body.code).toBe("ALREADY_MEMBER");
    const to = email("twice");
    await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: to, role: "member" });
    expect((await owner.b.post<{ code: string }>("/workspace/invite", { workspaceId: owner.workspaceId, email: to, role: "admin" })).body.code).toBe("ALREADY_INVITED");
  });

  it(`at most ${INVITATIONS_PER_HOUR} new invitations an hour per workspace`, async () => {
    const owner = await newAccount(route, "hour-owner");
    for (let i = 0; i < INVITATIONS_PER_HOUR; i++) expect((await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: email(`h${i}`), role: "member" })).status).toBe(200);
    const res = await owner.b.post<{ code: string }>("/workspace/invite", { workspaceId: owner.workspaceId, email: email("h-over"), role: "member" });
    expect([res.status, res.body.code]).toEqual([429, "TOO_MANY_INVITATIONS"]);
  });
});

describe("workspace A and workspace B", () => {
  it("B's owner cannot resend, revoke or invite into A, nor reach A's invitations by naming them under B", async () => {
    const a = await newAccount(route, "isoA");
    const b = await newAccount(route, "isoB");
    const inv = await a.b.post<Sent>("/workspace/invite", { workspaceId: a.workspaceId, email: email("iso-x"), role: "member" });
    for (const [path, body] of [
      ["/workspace/invite", { workspaceId: a.workspaceId, email: email("iso-y"), role: "member" }],
      ["/workspace/invitation/resend", { workspaceId: a.workspaceId, invitationId: inv.body.invitationId }],
      ["/workspace/invitation/revoke", { workspaceId: a.workspaceId, invitationId: inv.body.invitationId }],
    ] as const) {
      const res = await b.b.post<{ code: string }>(path, body);
      expect([res.status, res.body.code], path).toEqual([404, "WORKSPACE_NOT_FOUND"]);
    }
    const under = await b.b.post<{ code: string }>("/workspace/invitation/revoke", { workspaceId: b.workspaceId, invitationId: inv.body.invitationId });
    expect([under.status, under.body.code]).toEqual([404, "INVITATION_NOT_FOUND"]);
    expect((await db.query("SELECT status FROM invitation WHERE id = $1", [inv.body.invitationId])).rows[0].status).toBe("pending");
  });
});

describe("'no mail' mode", () => {
  it("the link is handed back to the inviter, and nothing of it reaches the log", async () => {
    const owner = await newAccount(route, "nomail-owner");
    const { makeAuth } = await import("@/lib/auth2/auth");
    const g = globalThis as unknown as { __c2rAuth2?: unknown };
    const keep = g.__c2rAuth2;
    g.__c2rAuth2 = { db, auth: makeAuth(db, { mail: null, rateLimit: false }) };
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) => vi.spyOn(console, k).mockImplementation((...x: unknown[]) => void lines.push(x.map(String).join(" "))));
    const to = email("nomail-invitee");
    let token = "";
    try {
      const before = sent.length;
      const res = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: to, role: "member" });
      expect(res.body.mailed).toBe(false);
      expect(res.body.link).toMatch(/\/auth\/invite\?token=/);
      expect(sent.length).toBe(before);
      token = new URL(res.body.link!).searchParams.get("token")!;
      expect(lines.join("\n")).not.toContain(token);
    } finally {
      for (const s of spies) s.mockRestore();
      g.__c2rAuth2 = keep;
    }
    // The handed-over link works like an emailed one.
    const invitee = await newAccount(route, "nomail-invitee", to);
    expect((await invitee.b.post("/workspace/invitation/accept", { token })).status).toBe(200);
  });
});

describe("the throttle on endpoints that send mail", () => {
  it("one network address gets 429 after ten invitations a minute", async () => {
    const owner = await newAccount(route, "thr-owner");
    const { makeAuth } = await import("@/lib/auth2/auth");
    const g = globalThis as unknown as { __c2rAuth2?: unknown };
    const keep = g.__c2rAuth2;
    g.__c2rAuth2 = { db, auth: makeAuth(db, { mail: { send: async () => undefined }, rateLimit: true }) };
    try {
      const codes: number[] = [];
      for (let i = 0; i < 11; i++) codes.push((await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: email(`t${i}`), role: "member" })).status);
      expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
      expect(codes[10]).toBe(429);
    } finally {
      g.__c2rAuth2 = keep;
      await db.query('DELETE FROM "rateLimit"');
    }
  });
});

describe("audit lines", () => {
  it("inviting, resending, revoking and joining are recorded, with no token in them", async () => {
    const owner = await newAccount(route, "aud-owner");
    const invitee = await newAccount(route, "aud-invitee");
    const inv = await owner.b.post<Sent>("/workspace/invite", { workspaceId: owner.workspaceId, email: email("aud-x"), role: "member" });
    await db.query("UPDATE auth2_invitation_tokens SET sent_at = now() - interval '2 minutes' WHERE invitation_id = $1", [inv.body.invitationId]);
    await owner.b.post("/workspace/invitation/resend", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId });
    await owner.b.post("/workspace/invitation/revoke", { workspaceId: owner.workspaceId, invitationId: inv.body.invitationId });
    await owner.b.post("/workspace/invite", { workspaceId: owner.workspaceId, email: invitee.email, role: "member" });
    const token = tokenOf(invitee.email);
    await invitee.b.post("/workspace/invitation/accept", { token });
    expect((await auditOf(db, owner.email)).map((l) => l.action)).toEqual(expect.arrayContaining(["workspace.invited", "workspace.invitation_resent", "workspace.invitation_revoked"]));
    expect((await auditOf(db, invitee.email)).map((l) => l.action)).toContain("workspace.joined");
    const all = await db.query<{ t: string }>("SELECT string_agg(summary || detail::text, ' ') AS t FROM audit_log WHERE actor IN ($1, $2)", [owner.email, invitee.email]);
    expect(all.rows[0].t).not.toContain(token);
  });
});
