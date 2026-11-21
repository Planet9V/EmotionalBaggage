// X against the stand-in (plan 8.18): OAuth 2.0 with PKCE and its state checks, the cost
// acknowledgement gate, sending only approved posts and replies one at a time after a confirmation,
// mentions, reply drafts through the drafting engine, token refresh, and no secret anywhere.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as CONNECT } from "@/app/api/channels/x/connect/route";
import { GET as CALLBACK } from "@/app/api/channels/x/callback/route";
import { POST as ACK } from "@/app/api/channels/x/ack/route";
import { POST as SEND } from "@/app/api/channels/send/route";
import { GET as PREVIEW } from "@/app/api/channels/send/preview/route";
import { POST as FETCH } from "@/app/api/channels/inbox/fetch/route";
import { PATCH as ITEM_PATCH } from "@/app/api/items/[id]/route";
import { POST as TEST } from "@/app/api/admin/test/route";
import { resetX, challengeOf, browserOrigin } from "@/lib/channels/x";
import { saveXAccount } from "@/lib/channels/state";
import { X_COST_STATEMENT, postCost } from "@/lib/channels/xCost";
import type { Preview } from "@/lib/channels/send";
import { setChannelClock } from "@/lib/channels/rateLimit";
import type { StandIn } from "../standins/core";
import { start as startModel, type OpenAIOptions } from "../standins/openai";
import { startX, type XOptions } from "../standins/channels";
import { ctx, json, read } from "../api/helpers";
import { addItem, approve, makeConcept, run } from "../drafts/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { clearChannelRows, expectNoSecrets, saveCreds } from "./helpers";

const P = "zz-channels-x";
let s: StandIn<XOptions>;
let model: StandIn<OpenAIOptions>;
let modelReply = JSON.stringify({ rows: [] });
const BASE = "http://test.local";
const SECRETS = ["x-client-secret-stand-in-0001", "x-access-1-stand-in-token", "x-refresh-1-stand-in-token", "x-access-2-stand-in-token", "x-refresh-2-stand-in-token"];

beforeAll(async () => {
  s = await startX({ clientSecret: "x-client-secret-stand-in-0001" });
  model = await startModel({ prefix: "/v1", reply: () => modelReply });
  process.env.X_API_BASE_URL = s.url;
  process.env.X_AUTHORIZE_URL = `${s.url}/i/oauth2/authorize`;
  await makeConcept(P, "ZZ X");
});

afterAll(async () => {
  setChannelClock(null);
  resetX();
  await clearChannelRows();
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  delete process.env.X_API_BASE_URL;
  delete process.env.X_AUTHORIZE_URL;
  await s.close();
  await model.close();
  await pool().end();
});

beforeEach(() => {
  s.requests.length = 0;
});

const connect = async () => {
  const r = await read<{ url: string; redirectUri: string }>(await CONNECT(json("POST", {}, `${BASE}/api/channels/x/connect`)));
  expect(r.status).toBe(200);
  return { ...r.body, params: new URL(r.body.url).searchParams };
};
const callback = (query: string) => CALLBACK(json("GET", undefined, `${BASE}/api/channels/x/callback?${query}`));
const savedToken = async () => (await q<{ value: string }>("SELECT value FROM credentials WHERE provider='x' AND field='accessToken'"))[0]?.value ?? null;

describe("Connect X account (OAuth 2.0 with PKCE)", () => {
  beforeAll(async () => {
    resetX();
    await clearChannelRows();
  });

  it("needs the client ID first", async () => {
    const r = await read<{ error: string }>(await CONNECT(json("POST", {}, `${BASE}/api/channels/x/connect`)));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/client ID/);
    await saveCreds("x", { clientId: "stand-in-x-client", clientSecret: "x-client-secret-stand-in-0001" });
  });

  it("builds the authorize URL with S256, a state and this app's callback; the verifier never leaves the server", async () => {
    const c = await connect();
    expect(c.url.startsWith(`${s.url}/i/oauth2/authorize?`)).toBe(true);
    expect(c.params.get("response_type")).toBe("code");
    expect(c.params.get("code_challenge_method")).toBe("S256");
    expect(c.params.get("redirect_uri")).toBe(`${BASE}/api/channels/x/callback`);
    expect(c.params.get("scope")).toBe("tweet.read tweet.write users.read media.write offline.access");
    expect(c.params.get("state")!.length).toBeGreaterThanOrEqual(40);
    expect(c.params.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(c.url).not.toContain("code_verifier");
    expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"); // RFC 7636 appendix B
  });

  it("builds the callback from the address the browser used, or a proxy's forwarded host", () => {
    expect(browserOrigin(new Request("http://localhost:3000/x", { headers: { host: "127.0.0.1:3373" } }))).toBe("http://127.0.0.1:3373");
    expect(browserOrigin(new Request("http://localhost:3000/x", { headers: { host: "app:3000", "x-forwarded-host": "c2r.example.com", "x-forwarded-proto": "https" } }))).toBe("https://c2r.example.com");
  });

  it("refuses a state it did not start, saves nothing and exchanges nothing", async () => {
    const r = await callback("code=anything&state=not-a-state-we-started");
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toContain("x=state");
    expect(await savedToken()).toBeNull();
    expect(s.requests.filter((x) => x.path === "/2/oauth2/token")).toHaveLength(0);
  });

  it("a wrong verifier (code issued for another challenge) fails at X and saves nothing", async () => {
    const c = await connect();
    s.set({ codes: { "code-wrong": challengeOf("some-other-verifier-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") } });
    const r = await callback(`code=code-wrong&state=${c.params.get("state")}`);
    expect(r.headers.get("location")).toContain("x=failed");
    expect(await savedToken()).toBeNull();
  });

  it("the right code and state save the tokens, read the account, and the state cannot be used twice", async () => {
    const c = await connect();
    s.set({ codes: { "code-ok": c.params.get("code_challenge")! } });
    const r = await callback(`code=code-ok&state=${c.params.get("state")}`);
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toMatch(/\/admin\?tab=credentials&x=connected/);
    expect(r.headers.get("location")).not.toMatch(/token|code-ok/);
    const tokenCall = s.requests.find((x) => x.path === "/2/oauth2/token")!;
    expect(String(tokenCall.headers.authorization)).toMatch(/^Basic /); // confidential client
    expect(new URLSearchParams(tokenCall.rawBody.toString()).get("redirect_uri")).toBe(`${BASE}/api/channels/x/callback`);
    expect(await savedToken()).toBe("x-access-1-stand-in-token");
    const again = await callback(`code=code-ok&state=${c.params.get("state")}`);
    expect(again.headers.get("location")).toContain("x=state");
    const audit = await q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'channel.x.%' ORDER BY id");
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["channel.x.connect-started", "channel.x.connected", "channel.x.connect-refused", "channel.x.connect-failed"]));
  });

  it("the connection test reads the account and says what it costs", async () => {
    const r = await read<{ ok: boolean; message: string }>(await TEST(json("POST", { kind: "x" })));
    expect(r.body.ok).toBe(true);
    expect(r.body.message).toMatch(/@baggageclaims/);
    expect(r.body.message).toMatch(/\$0\.010/);
  });

  it("refreshes an expired access token with the refresh token and saves both", async () => {
    await saveXAccount({ userId: "1500000000000000001", username: "baggageclaims", expiresAt: Date.now() - 1000, scope: "", connectedAt: new Date().toISOString() });
    const r = await read<{ ok: boolean }>(await TEST(json("POST", { kind: "x" })));
    expect(r.body.ok).toBe(true);
    const grant = s.requests.filter((x) => x.path === "/2/oauth2/token").map((x) => new URLSearchParams(x.rawBody.toString()).get("grant_type"));
    expect(grant).toEqual(["refresh_token"]);
    expect(await savedToken()).toBe("x-access-2-stand-in-token");
  });
});

describe("sending a post", () => {
  let postId = 0;
  const preview = async (id: number, kind = "post") => read<Preview & { error?: string }>(await PREVIEW(json("GET", undefined, `${BASE}/api/channels/send/preview?projectId=${P}&kind=${kind}&itemId=${id}`)));
  const send = async (id: number, confirm: Record<string, unknown>, kind = "post") => read<{ ok?: boolean; id?: string; error?: string; detail?: unknown }>(await SEND(json("POST", { projectId: P, kind, itemId: id, confirm })));

  beforeAll(async () => {
    postId = await addItem(P, "marketing/social", "Launch post", { channel: "X" }, "Baggage Claims MK1 ships in March.", "draft");
  });

  it("states the cost from the sourced statement, with its date, and a link raises it", () => {
    expect(X_COST_STATEMENT.read).toBe("2026-11-21");
    expect(postCost("plain text")).toEqual({ usd: 0.015, rule: "Post: Create" });
    expect(postCost("see https://example.com").usd).toBe(0.2);
  });

  it("a draft post cannot be sent, through preview or send, even with a correct hash", async () => {
    const p = await preview(postId);
    expect(p.body.sendable).toBe(false);
    expect(p.body.blocked).toMatch(/Only an approved post/);
    expect(p.body.blocked).toMatch(/cost statement/);
    const r = await send(postId, { channel: "x", itemId: postId, textSha256: p.body.textSha256 });
    expect(r.status).toBe(409);
    expect(s.requests.some((x) => x.path === "/2/tweets")).toBe(false);
  });

  it("an AI draft in the drafts table is not a row and cannot be sent", async () => {
    const d = await q<{ id: string }>(
      "INSERT INTO drafts (project_id, generator, target_store, title, body, data, run_id) VALUES ($1,'social-posts','marketing/social','Drafted post','Draft text','{\"channel\":\"X\"}',gen_random_uuid()) RETURNING id",
      [P]
    );
    const id = Number(d[0].id) + 100000; // a draft id is never an item id; try both the raw id and an unused one
    for (const tryId of [Number(d[0].id), id]) {
      const r = await send(tryId, { channel: "x", itemId: tryId, textSha256: "0".repeat(64) });
      expect([404, 409]).toContain(r.status);
    }
    expect(s.requests.some((x) => x.path === "/2/tweets")).toBe(false);
  });

  it("the cost acknowledgement needs the current version and a tick, and is recorded", async () => {
    expect((await read(await ACK(json("POST", { version: "old-version", read: true })))).status).toBe(409);
    expect((await read(await ACK(json("POST", { version: X_COST_STATEMENT.version, read: false })))).status).toBe(400);
    expect((await read(await ACK(json("POST", { version: X_COST_STATEMENT.version, read: true })))).status).toBe(200);
    const a = await q<{ detail: { version: string } }>("SELECT detail FROM audit_log WHERE action='channel.x.cost-acknowledged'");
    expect(a[0].detail.version).toBe(X_COST_STATEMENT.version);
  });

  it("an approved post is sent once, only with the confirmed text and channel, and recorded", async () => {
    expect((await read(await ITEM_PATCH(json("PATCH", { status: "approved" }), ctx(String(postId))))).status).toBe(200);
    const p = await preview(postId);
    expect(p.body.sendable).toBe(true);
    expect(p.body.cost).toMatchObject({ usd: 0.015, acknowledged: true });
    expect(p.body.account).toBe("@baggageclaims");

    expect((await send(postId, { channel: "x", itemId: postId, textSha256: "a".repeat(64) })).status).toBe(409); // not the text shown
    expect((await send(postId, { channel: "instagram", itemId: postId, textSha256: p.body.textSha256 })).status).toBe(409); // wrong place
    expect((await send(postId, { channel: "x", itemId: postId + 1, textSha256: p.body.textSha256 })).status).toBe(400); // names another row
    expect(s.requests.some((x) => x.path === "/2/tweets")).toBe(false);

    const ok = await send(postId, { channel: "x", itemId: postId, textSha256: p.body.textSha256 });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(s.requests.filter((x) => x.path === "/2/tweets")).toHaveLength(1);
    expect((s.requests.find((x) => x.path === "/2/tweets")!.body as { text: string }).text).toBe("Baggage Claims MK1 ships in March.");
    const row = (await q<{ status: string; data: { sent: { id: string; url: string } } }>("SELECT status, data FROM items WHERE id=$1", [postId]))[0];
    expect(row.status).toBe("posted");
    expect(row.data.sent.id).toBe(ok.body.id);

    const twice = await send(postId, { channel: "x", itemId: postId, textSha256: p.body.textSha256 });
    expect(twice.status).toBe(409);
    expect(s.requests.filter((x) => x.path === "/2/tweets")).toHaveLength(1);
    const ev = await q<{ kind: string; data: Record<string, unknown> }>("SELECT kind, data FROM events WHERE project_id=$1 AND kind LIKE 'channel.post.%' ORDER BY id", [P]);
    expect(ev.map((e) => e.kind)).toEqual(["channel.post.confirmed", "channel.post.sent"]);
    expect(ev[0].data).toMatchObject({ channel: "x", itemId: postId, textSha256: p.body.textSha256, costUsd: 0.015 });
  });

  it("uploads the post's images from Imagery and attaches them", async () => {
    const f = await q<{ id: string }>("INSERT INTO files (project_id, name, mime, size, sha256, bytes) VALUES ($1,'hero.png','image/png',4,'x',$2) RETURNING id", [P, Buffer.from([137, 80, 78, 71])]);
    await addItem(P, "marketing/imagery", "Hero on white", { shotKey: "hero-white", fileId: Number(f[0].id) });
    const id = await addItem(P, "marketing/social", "With image", { channel: "x", mediaShotKeys: ["hero-white"] }, "Look at it.", "scheduled");
    const p = await preview(id);
    expect(p.body.media).toEqual([{ shotKey: "hero-white", fileId: Number(f[0].id), ok: true, problem: "" }]);
    const r = await send(id, { channel: "x", itemId: id, textSha256: p.body.textSha256 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const up = s.requests.find((x) => x.path === "/2/media/upload")!;
    expect((up.body as { media_category: string }).media_category).toBe("tweet_image");
    expect((s.requests.filter((x) => x.path === "/2/tweets").at(-1)!.body as { media: { media_ids: string[] } }).media.media_ids).toHaveLength(1);
  });

  it("a failed send (429 from X) records the failure, frees the row and posts nothing", async () => {
    const id = await addItem(P, "marketing/social", "Throttled", { channel: "X" }, "Try me.", "approved");
    s.set({ throttlePosts: 1 });
    const p = await preview(id);
    const r = await send(id, { channel: "x", itemId: id, textSha256: p.body.textSha256 });
    expect(r.status).toBe(429);
    const row = (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [id]))[0];
    expect(row.status).toBe("approved");
    expect(row.data.sending).toBeUndefined();
    expect(row.data.sendError).toBeTruthy();
    const again = await send(id, { channel: "x", itemId: id, textSha256: p.body.textSha256 });
    expect(again.status).toBe(200);
  });
});

describe("mentions and replies", () => {
  it("reading mentions is refused until the cost statement is read, then reads them once each", async () => {
    await q("DELETE FROM settings WHERE key='channels.x.costAck'");
    s.set({ mentions: [{ id: "1900000000000000101", text: "@baggageclaims does it fit a carry-on?", author_id: "2001", created_at: "2026-11-21T08:00:00.000Z", conversation_id: "1900000000000000001" }] });
    const refused = await read<{ error: string }>(await FETCH(json("POST", { projectId: P, channel: "x" })));
    expect(refused.status).toBe(409);
    await read(await ACK(json("POST", { version: X_COST_STATEMENT.version, read: true })));
    const r1 = await read<{ added: number; read: number }>(await FETCH(json("POST", { projectId: P, channel: "x" })));
    expect(r1.body).toMatchObject({ added: 1, read: 1 });
    const r2 = await read<{ added: number }>(await FETCH(json("POST", { projectId: P, channel: "x" })));
    expect(r2.body.added).toBe(0);
    expect(s.requests.filter((x) => x.path.endsWith("/mentions")).at(-1)!.query.since_id).toBe("1900000000000000101");
    const rows = await q<{ data: Record<string, unknown>; status: string }>("SELECT data, status FROM items WHERE project_id=$1 AND section='marketing/inbox'", [P]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("new");
    expect(rows[0].data).toMatchObject({ channel: "X", replyTo: "1900000000000000101", author: "user001", externalId: "x:1900000000000000101" });
  });

  it("drafts a reply in the brand voice as a draft; approval makes a reply row; sending answers the mention", async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${model.url}/v1`, model: "stand-in-drafter" });
    await addItem(P, "marketing/brand", "Brand kit", { kind: "kit", voiceSummary: "Plain and dry, never salesy." });
    const inbox = (await q<{ id: string }>("SELECT id FROM items WHERE project_id=$1 AND section='marketing/inbox'", [P]))[0];
    const inboxId = Number(inbox.id);
    modelReply = JSON.stringify({ rows: [{ answers: inboxId, text: "Yes. It is 35 by 20 by 8 cm.", reasoning: "Answers the size question." }, { answers: 999999, text: "Not a real message." }] });
    const r = await run({ projectId: P, generator: "replies" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.dropped).toHaveLength(1);
    const sys = String((model.requests.at(-1)!.body as { messages: { content: string }[] }).messages[0].content);
    expect(sys).toContain("You draft replies");
    const user = String((model.requests.at(-1)!.body as { messages: { content: string }[] }).messages[1].content);
    expect(user).toContain("Plain and dry, never salesy.");
    expect(r.body.drafts[0].sources.map((x) => x.id)).toContain(inboxId);

    // Not sendable while it is a draft: there is no reply row yet.
    expect((await q("SELECT 1 FROM items WHERE project_id=$1 AND section='marketing/replies'", [P])).length).toBe(0);

    const a = await approve(r.body.drafts[0].id);
    const replyId = a.body.item!.id;
    const row = (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [replyId]))[0];
    expect(row.status).toBe("approved");
    expect(row.data).toMatchObject({ channel: "X", answers: inboxId, replyTo: "1900000000000000101" });

    const p = await read<Preview>(await PREVIEW(json("GET", undefined, `${BASE}/api/channels/send/preview?projectId=${P}&kind=reply&itemId=${replyId}`)));
    expect(p.body.sendable).toBe(true);
    const sent = await read(await SEND(json("POST", { projectId: P, kind: "reply", itemId: replyId, confirm: { channel: "x", itemId: replyId, textSha256: p.body.textSha256 } })));
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(s.requests.filter((x) => x.path === "/2/tweets").at(-1)!.body).toMatchObject({ text: "Yes. It is 35 by 20 by 8 cm.", reply: { in_reply_to_tweet_id: "1900000000000000101" } });
    expect((await q<{ status: string }>("SELECT status FROM items WHERE id=$1", [inboxId]))[0].status).toBe("answered");
    expect((await q<{ status: string }>("SELECT status FROM items WHERE id=$1", [replyId]))[0].status).toBe("sent");
  });

  it("no secret is in any response, the audit log, the activity list, settings or rows", async () => {
    const st = await read(await TEST(json("POST", { kind: "x" })));
    await expectNoSecrets(SECRETS, [st.body]);
  });
});
