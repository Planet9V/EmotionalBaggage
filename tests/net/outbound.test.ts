// Robustness review S3: one rule for every outbound call to an address a user typed.
// Repro: POST /api/admin/test {"kind":"planner","url":"http://127.0.0.1:4455"} returned the internal service's body text.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { addressProblem, safeFetch } from "@/lib/net/outbound";
import { POST as runTest } from "@/app/api/admin/test/route";
import { json as reply, startStandIn, type StandIn } from "../standins/core";
import { json, read } from "../api/helpers";
import { clearAdmin, restore, snapshot } from "../admin/fixture";

const SECRET_BODY = "INTERNAL-SERVICE-SECRET-TEXT-42";
const running: StandIn<unknown>[] = [];
async function internal(status = 500, delayMs = 0) {
  const s = await startStandIn<{ delayMs?: number }>({ delayMs }, (req) => {
    if (req.path === "/sse") return { status: 200, sse: ["one", "two"] };
    if (req.path === "/echo") return reply(201, { method: req.method, body: req.body, auth: req.headers.authorization ?? null });
    return reply(status, { error: { message: SECRET_BODY }, ok: false });
  });
  running.push(s as unknown as StandIn<unknown>);
  return s;
}

let snap: Awaited<ReturnType<typeof snapshot>>;
beforeAll(async () => {
  snap = await snapshot();
});
beforeEach(clearAdmin);
afterEach(async () => {
  await Promise.all(running.splice(0).map((s) => s.close()));
});
afterAll(async () => {
  await restore(snap);
  await pool().end();
});

describe("addressProblem", () => {
  it.each([
    ["169.254.169.254", true],
    ["169.254.0.1", true],
    ["0.0.0.0", true],
    ["0.1.2.3", true],
    ["fe80::1", true],
    ["fe80::1%eth0", true],
    ["[fe80::abcd]", true],
    ["fd00:ec2::254", true],
    ["::", true],
    ["::ffff:169.254.169.254", true],
    ["127.0.0.1", false],
    ["::1", false],
    ["10.0.0.5", false],
    ["172.16.4.4", false],
    ["192.168.1.50", false],
    ["fd12:3456::1", false],
    ["8.8.8.8", false],
    ["2606:4700::1111", false],
  ])("%s refused: %s", (ip, refused) => {
    expect(addressProblem(ip) !== null).toBe(refused);
  });
});

describe("safeFetch", () => {
  it("behaves like fetch for an allowed address: method, body, headers, status, streaming", async () => {
    const s = await internal();
    const r = await safeFetch(`${s.url}/echo`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer k" }, body: JSON.stringify({ a: 1 }) });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ method: "POST", body: { a: 1 }, auth: "Bearer k" });
    const sse = await safeFetch(`${s.url}/sse`);
    expect(await sse.text()).toContain("data: two");
    const form = new FormData();
    form.set("file", new Blob(["G1 X0"]), "x.gcode");
    const up = await safeFetch(`${s.url}/echo`, { method: "POST", body: form });
    expect(up.status).toBe(201);
  });

  it("refuses link-local, metadata and unspecified addresses without connecting", async () => {
    for (const u of ["http://169.254.169.254/latest/meta-data/", "http://[fe80::1]/", "http://[fd00:ec2::254]/", "http://0.0.0.0:80/", "http://[::ffff:169.254.169.254]/"]) {
      const e = (await safeFetch(u).then(() => null, (x) => x)) as { cause?: { code?: string } } | null;
      expect(e?.cause?.code, u).toBe("EADDRBLOCKED");
    }
  });

  it("does not follow redirects", async () => {
    const s = await startStandIn<object>({}, () => ({ status: 302, headers: { location: "http://169.254.169.254/" } }));
    running.push(s as unknown as StandIn<unknown>);
    const r = await safeFetch(s.url);
    expect(r.status).toBe(302);
  });

  it("times out like fetch", async () => {
    const s = await internal(200, 2000);
    const e = (await safeFetch(s.url, { signal: AbortSignal.timeout(100) }).then(() => null, (x) => x)) as { name?: string } | null;
    expect(e?.name).toBe("TimeoutError");
  });
});

describe("connection tests do not echo a remote body", () => {
  const test = async (b: unknown) => read<{ ok: boolean; message: string; detail?: Record<string, unknown> }>(await runTest(json("POST", b)));

  it("the reviewer's repro: the planner test shows status and our sentence only", async () => {
    const s = await internal(500);
    const r = await test({ kind: "planner", url: s.url });
    expect(r.body.ok).toBe(false);
    expect(JSON.stringify(r.body)).not.toContain(SECRET_BODY);
    expect(r.body.detail).toEqual({ status: 500 });
  });

  it("model and embedding tests too", async () => {
    const s = await internal(403);
    for (const b of [
      { kind: "model", provider: "ollama", baseUrl: s.url },
      { kind: "embedding", provider: "ollama", baseUrl: s.url, model: "m", dims: 3 },
    ]) {
      const r = await test(b);
      expect(r.body.ok).toBe(false);
      expect(JSON.stringify(r.body)).not.toContain(SECRET_BODY);
    }
  });

  it("a metadata address is refused in plain words, for every kind that takes an address", async () => {
    for (const b of [
      { kind: "planner", url: "http://169.254.169.254" },
      { kind: "model", provider: "ollama", baseUrl: "http://169.254.169.254/v1" },
      { kind: "printer", family: "octoprint", access: { address: "http://169.254.169.254", apiKey: "k" } },
    ]) {
      const r = await test(b);
      expect(r.body.ok, JSON.stringify(b)).toBe(false);
      expect(r.body.message).toMatch(/is not allowed: it is a link-local address/);
    }
  });
});
