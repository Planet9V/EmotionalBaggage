// Instagram against the stand-in (plan 8.19): the public-address rule, container then publish only for
// an approved post after confirmation, the 24-hour quota, comments read once, replies sent on approval,
// the App Review checklist, and no token anywhere.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as SEND } from "@/app/api/channels/send/route";
import { GET as PREVIEW } from "@/app/api/channels/send/preview/route";
import { POST as IMAGE } from "@/app/api/channels/instagram/image/route";
import { GET as REVIEW_GET, PUT as REVIEW_PUT } from "@/app/api/channels/instagram/review/route";
import { POST as FETCH } from "@/app/api/channels/inbox/fetch/route";
import { POST as TEST } from "@/app/api/admin/test/route";
import { publicImageProblem } from "@/lib/channels/instagram";
import { setChannelClock } from "@/lib/channels/rateLimit";
import type { Preview } from "@/lib/channels/send";
import type { StandIn } from "../standins/core";
import { startInstagram, type IgOptions } from "../standins/channels";
import { json, read } from "../api/helpers";
import { addItem, makeConcept } from "../drafts/helpers";
import { clearChannelRows, expectNoSecrets, fakeClock, saveCreds } from "./helpers";

const P = "zz-channels-ig";
const TOKEN = "IGAA-stand-in-long-lived-token-0001";
let s: StandIn<IgOptions>;
const IMG = "https://cdn.example.com/shots/hero.jpg";

beforeAll(async () => {
  s = await startInstagram({
    media: [{ id: "18000000000000001", permalink: "https://www.instagram.com/p/standin/", comments: [{ id: "17900000000000001", text: "Is it waterproof?", username: "traveller", timestamp: "2026-11-21T08:00:00+0000" }] }],
  });
  process.env.INSTAGRAM_GRAPH_BASE_URL = `${s.url}/v27.0`;
  await clearChannelRows();
  await makeConcept(P, "ZZ Instagram");
  fakeClock();
});

afterAll(async () => {
  setChannelClock(null);
  await clearChannelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  delete process.env.INSTAGRAM_GRAPH_BASE_URL;
  await s.close();
  await pool().end();
});

const preview = async (id: number, kind = "post") => read<Preview>(await PREVIEW(json("GET", undefined, `http://t/api/channels/send/preview?projectId=${P}&kind=${kind}&itemId=${id}`)));

describe("public image addresses", () => {
  it("accepts a public https JPEG and refuses this machine, private networks, http and other formats", () => {
    expect(publicImageProblem(IMG)).toBeNull();
    for (const bad of ["http://cdn.example.com/a.jpg", "https://localhost/a.jpg", "https://192.168.1.10/a.jpg", "https://10.0.0.2/a.jpg", "https://box.local/a.jpg", "https://cdn.example.com/a.png", "https://u:p@cdn.example.com/a.jpg", "not a url"]) {
      expect(publicImageProblem(bad), bad).not.toBeNull();
    }
  });
});

describe("publishing and comments", () => {
  it("says it is not connected when nothing is saved", async () => {
    const r = await read<{ ok: boolean; message: string }>(await TEST(json("POST", { kind: "instagram" })));
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/not connected/);
    await saveCreds("instagram", { accessToken: TOKEN, accountId: "17841400000000001" });
    const ok = await read<{ ok: boolean; message: string }>(await TEST(json("POST", { kind: "instagram" })));
    expect(ok.body.ok).toBe(true);
    expect(ok.body.message).toMatch(/@baggageclaims/);
  });

  it("publishes an approved post through a container only after the image address is saved and confirmed", async () => {
    const id = await addItem(P, "marketing/social", "IG post", { channel: "instagram" }, "Meet MK1.", "approved");
    const p0 = await preview(id);
    expect(p0.body.sendable).toBe(false);
    expect(p0.body.blocked).toMatch(/public address/);
    expect((await read(await IMAGE(json("POST", { projectId: P, itemId: id, imageUrl: "https://localhost/a.jpg" })))).status).toBe(400);
    expect((await read(await IMAGE(json("POST", { projectId: P, itemId: id, imageUrl: IMG, altText: "The case on white" })))).status).toBe(200);
    const p = await preview(id);
    expect(p.body.sendable).toBe(true);
    expect(p.body.cost).toBeNull();
    // the confirmation must name the saved address
    expect((await read(await SEND(json("POST", { projectId: P, kind: "post", itemId: id, confirm: { channel: "instagram", itemId: id, textSha256: p.body.textSha256, imageUrl: "https://cdn.example.com/other.jpg" } })))).status).toBe(409);
    expect(s.requests.some((r) => r.path.endsWith("/media"))).toBe(false);
    const r = await read<{ id: string }>(await SEND(json("POST", { projectId: P, kind: "post", itemId: id, confirm: { channel: "instagram", itemId: id, textSha256: p.body.textSha256, imageUrl: IMG } })));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const paths = s.requests.map((x) => `${x.method} ${x.path.replace(/^\/v27\.0/, "")}`);
    const iMedia = paths.indexOf("POST /17841400000000001/media");
    const iPublish = paths.indexOf("POST /17841400000000001/media_publish");
    expect(iMedia).toBeGreaterThan(-1);
    expect(iPublish).toBeGreaterThan(iMedia);
    expect(s.requests[iMedia].body).toMatchObject({ image_url: IMG, caption: "Meet MK1.", alt_text: "The case on white" });
    expect(s.requests.every((x) => !String(x.path).includes(TOKEN) && !JSON.stringify(x.query).includes(TOKEN))).toBe(true); // token only in the header
    expect((await q<{ status: string }>("SELECT status FROM items WHERE id=$1", [id]))[0].status).toBe("posted");
  });

  it("refuses to publish when the 24-hour quota is used up", async () => {
    s.set({ quotaUsage: 100 });
    const id = await addItem(P, "marketing/social", "IG two", { channel: "Instagram", publicImageUrl: IMG }, "Again.", "approved");
    const p = await preview(id);
    const r = await read<{ error: string }>(await SEND(json("POST", { projectId: P, kind: "post", itemId: id, confirm: { channel: "instagram", itemId: id, textSha256: p.body.textSha256, imageUrl: IMG } })));
    expect(r.status).toBe(429);
    expect(r.body.error).toMatch(/100 published posts in 24 hours/);
    s.set({ quotaUsage: 0 });
  });

  it("reads comments once each and sends an approved reply", async () => {
    const r1 = await read<{ added: number }>(await FETCH(json("POST", { projectId: P, channel: "instagram" })));
    expect(r1.body.added).toBe(1);
    expect((await read<{ added: number }>(await FETCH(json("POST", { projectId: P, channel: "instagram" })))).body.added).toBe(0);
    const inbox = (await q<{ id: string; data: Record<string, unknown> }>("SELECT id, data FROM items WHERE project_id=$1 AND section='marketing/inbox'", [P]))[0];
    expect(inbox.data).toMatchObject({ channel: "Instagram", replyTo: "17900000000000001", author: "traveller" });
    const replyId = await addItem(P, "marketing/replies", "Reply", { channel: "Instagram", answers: Number(inbox.id), replyTo: "17900000000000001" }, "It is splash resistant, not waterproof.", "withdrawn");
    const p0 = await preview(replyId, "reply");
    expect(p0.body.sendable).toBe(false); // withdrawn is not approved
    await q("UPDATE items SET status='approved' WHERE id=$1", [replyId]);
    const p = await preview(replyId, "reply");
    const r = await read(await SEND(json("POST", { projectId: P, kind: "reply", itemId: replyId, confirm: { channel: "instagram", itemId: replyId, textSha256: p.body.textSha256 } })));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const sent = s.requests.find((x) => x.method === "POST" && x.path.endsWith("/17900000000000001/replies"))!;
    expect(sent.body).toEqual({ message: "It is splash resistant, not waterproof." });
  });
});

describe("App Review checklist", () => {
  it("lists the items with links, saves ticks, refuses unknown keys and records the change", async () => {
    const g = await read<{ items: { key: string; links: { url: string }[] }[]; ticks: Record<string, boolean> }>(await REVIEW_GET(json("GET")));
    expect(g.body.items.map((i) => i.key)).toContain("app-review");
    expect(g.body.items.every((i) => i.links.every((l) => l.url.startsWith("https://")))).toBe(true);
    expect((await read(await REVIEW_PUT(json("PUT", { ticks: { nonsense: true } })))).status).toBe(400);
    const p = await read<{ ticks: Record<string, boolean> }>(await REVIEW_PUT(json("PUT", { ticks: { "professional-account": true } })));
    expect(p.body.ticks["professional-account"]).toBe(true);
    expect((await q("SELECT 1 FROM audit_log WHERE action='channel.instagram.review-checklist'")).length).toBeGreaterThan(0);
  });

  it("no token anywhere", async () => {
    await expectNoSecrets([TOKEN]);
  });
});
