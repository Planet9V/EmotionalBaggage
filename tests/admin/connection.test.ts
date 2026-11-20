// POST /api/admin/test against the stand-in servers: success, wrong key, server error, timeout and the
// kind-specific failures. No test reaches the internet.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { createServer } from "node:net";
import { pool, q } from "@/lib/db";
import { POST as runTest } from "@/app/api/admin/test/route";
import { PUT as putCredentials } from "@/app/api/admin/credentials/[provider]/route";
import { POST as addPrinter } from "@/app/api/admin/printers/route";
import { PUT as putSettings } from "@/app/api/admin/settings/route";
import { readAudit } from "@/lib/admin/audit";
import { scrub, setConnectionTestLimit } from "@/lib/admin/connection";
import * as openai from "../standins/openai";
import * as octoprint from "../standins/octoprint";
import * as moonraker from "../standins/moonraker";
import { json as reply, startStandIn, type StandIn } from "../standins/core";
import { json, read } from "../api/helpers";
import { clearAdmin, restore, snapshot } from "./fixture";

type Result = { ok: boolean; message: string; detail?: Record<string, unknown>; issues?: { field: string }[]; error?: string };

let snap: Awaited<ReturnType<typeof snapshot>>;
const running: StandIn<unknown>[] = [];
async function track<T>(p: Promise<T>): Promise<T> {
  const s = await p;
  running.push(s as unknown as StandIn<unknown>);
  return s;
}

beforeAll(async () => {
  snap = await snapshot();
});
beforeEach(clearAdmin);
afterEach(async () => {
  setConnectionTestLimit(null);
  await Promise.all(running.splice(0).map((s) => s.close()));
});
afterAll(async () => {
  await restore(snap);
  await pool().end();
});

const test = async (b: unknown) => read<Result>(await runTest(json("POST", b)));

/** An address where nothing listens. */
function deadAddress(): Promise<string> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const a = s.address() as { port: number };
      s.close(() => resolve(`http://127.0.0.1:${a.port}`));
    });
  });
}

describe("kind: model", () => {
  it("is ok when the host answers and the model is listed", async () => {
    const s = await track(openai.start({ models: ["qwen3:8b", "nomic-embed-text"] }));
    const r = await test({ kind: "model", provider: "ollama", baseUrl: `${s.url}/v1/`, model: "qwen3:8b" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, detail: { models: ["qwen3:8b", "nomic-embed-text"], total: 2 } });
    expect(s.requests.map((x) => `${x.method} ${x.path}`)).toEqual(["GET /v1/models"]);
  });

  it("says reachable but not listed when the model is missing, with up to 20 names", async () => {
    const models = Array.from({ length: 25 }, (_, i) => `model-${i}`);
    const s = await track(openai.start({ models }));
    const r = await test({ kind: "model", provider: "lmstudio", baseUrl: `${s.url}/v1`, model: "not-there" });
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toBe("Reachable, but that model is not in its list.");
    expect((r.body.detail!.models as string[]).length).toBe(20);
    expect(r.body.detail!.total).toBe(25);
  });

  it("uses the saved key when none is given, and the given key over the saved one", async () => {
    const KEY = "sk-or-v1-saved-key-000000000000";
    const s = await track(openai.start({ prefix: "/api/v1", apiKey: KEY }));
    await putCredentials(json("PUT", { fields: { apiKey: KEY } }), { params: Promise.resolve({ provider: "openrouter" }) });
    const ok = await test({ kind: "model", provider: "openrouter", baseUrl: `${s.url}/api/v1` });
    expect(ok.body.ok).toBe(true);
    expect(s.requests[0].headers.authorization).toBe(`Bearer ${KEY}`);

    const wrong = await test({ kind: "model", provider: "openrouter", baseUrl: `${s.url}/api/v1`, apiKey: "sk-wrong-key-111111111" });
    expect(wrong.body.ok).toBe(false);
    expect(wrong.body.message).toMatch(/refused the key \(HTTP 401\)/);
    expect(JSON.stringify(wrong.body)).not.toContain("sk-wrong-key-111111111");
  });

  it("explains a server error, a wrong path, a timeout and a refused connection", async () => {
    const s = await track(openai.start({ failWith: 500 }));
    const e500 = await test({ kind: "model", provider: "ollama", baseUrl: `${s.url}/v1` });
    expect(e500.body).toMatchObject({ ok: false, message: "The model host answered with a server error (HTTP 500).", detail: { status: 500 } });

    s.set({ failWith: undefined });
    const e404 = await test({ kind: "model", provider: "ollama", baseUrl: s.url });
    expect(e404.body.ok).toBe(false);
    expect(e404.body.message).toMatch(/HTTP 404.*\/v1/);

    setConnectionTestLimit(150);
    s.set({ delayMs: 2000 });
    const started = Date.now();
    const slow = await test({ kind: "model", provider: "ollama", baseUrl: `${s.url}/v1` });
    expect(slow.body).toEqual({ ok: false, message: "No answer within 150 ms." });
    expect(Date.now() - started).toBeLessThan(1500);

    const dead = await test({ kind: "model", provider: "ollama", baseUrl: `${await deadAddress()}/v1` });
    expect(dead.body.ok).toBe(false);
    expect(dead.body.message).toMatch(/connection refused/);
  });

  it("removes the key from any text the host sends back", async () => {
    const KEY = "sk-echoed-back-by-host-ABCDEFGH";
    const s = await track(
      startStandIn({}, (req) => reply(401, { error: { message: `Incorrect API key provided: ${req.headers.authorization}` } }))
    );
    const r = await test({ kind: "model", provider: "openrouter", baseUrl: s.url, apiKey: KEY });
    expect(r.body.ok).toBe(false);
    expect(r.body.detail!.says).toBe("Incorrect API key provided: Bearer [hidden]");
    expect(JSON.stringify(r.body)).not.toContain(KEY);
    expect(scrub("a KEY1 b KEY1", ["KEY1", null, "ab"])).toBe("a [hidden] b [hidden]");
  });

  it("validates its input", async () => {
    expect((await test({ kind: "model", provider: "ollama" })).body.issues?.[0].field).toBe("baseUrl");
    expect((await test({ kind: "model", provider: "anthropic", baseUrl: "http://h/v1" })).body.issues?.[0].field).toBe("provider");
    expect((await test({ kind: "model", provider: "ollama", baseUrl: "file:///etc/passwd" })).body.issues?.[0].field).toBe("baseUrl");
    expect((await test({ kind: "nope" })).status).toBe(400);
    expect((await test({})).status).toBe(400);
  });
});

describe("kind: embedding", () => {
  it("is ok when a vector of the given width comes back", async () => {
    const s = await track(openai.start({ dimensions: 8 }));
    const r = await test({ kind: "embedding", provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-embed", dims: 8 });
    expect(r.body).toMatchObject({ ok: true, detail: { width: 8 } });
    expect(s.requests[0]).toMatchObject({ method: "POST", path: "/v1/embeddings", body: { model: "stand-in-embed", input: "hello" } });
  });

  it("fails plainly when the width differs", async () => {
    const s = await track(openai.start({ dimensions: 8 }));
    const r = await test({ kind: "embedding", provider: "ollama", baseUrl: `${s.url}/v1`, model: "e", dims: 768 });
    expect(r.body).toEqual({ ok: false, message: "The model returned vectors 8 wide, but the width given is 768. Set the width to 8.", detail: { width: 8 } });
  });

  it("explains a wrong key, a server error and a timeout", async () => {
    const s = await track(openai.start({ apiKey: "right-key-000000000000" }));
    const base = { kind: "embedding", provider: "lmstudio", baseUrl: `${s.url}/v1`, model: "e", dims: 8 };
    expect((await test({ ...base, apiKey: "wrong-key-0000000000" })).body.message).toMatch(/refused the key/);
    expect((await test({ ...base, apiKey: "right-key-000000000000" })).body.ok).toBe(true);
    s.set({ failWith: 503, failPath: "/v1/embeddings" });
    expect((await test({ ...base, apiKey: "right-key-000000000000" })).body.message).toMatch(/server error \(HTTP 503\)/);
    s.set({ failWith: undefined, delayMs: 2000 });
    setConnectionTestLimit(150);
    expect((await test({ ...base, apiKey: "right-key-000000000000" })).body.message).toBe("No answer within 150 ms.");
  });

  it("requires dims", async () => {
    expect((await test({ kind: "embedding", provider: "ollama", baseUrl: "http://h/v1", model: "e" })).body.issues?.[0].field).toBe("dims");
    expect((await test({ kind: "embedding", provider: "ollama", baseUrl: "http://h/v1", model: "e", dims: 9000 })).body.issues?.[0].field).toBe("dims");
  });
});

describe("kind: perplexity", () => {
  it("says no key is saved, or that the test is not built yet, and calls nothing", async () => {
    expect((await test({ kind: "perplexity" })).body).toEqual({ ok: false, message: "No key is saved." });
    expect((await test({ kind: "perplexity", apiKey: "pplx-given-000000" })).body).toEqual({ ok: false, message: "A connection test for Perplexity is not built yet." });
    await putCredentials(json("PUT", { fields: { apiKey: "pplx-saved-000000" } }), { params: Promise.resolve({ provider: "perplexity" }) });
    expect((await test({ kind: "perplexity" })).body.message).toBe("A connection test for Perplexity is not built yet.");
  });
});

describe("kind: printer", () => {
  const KEY = "octo-key-for-tests-0123456789";

  it("tests a saved OctoPrint printer with GET /api/version", async () => {
    const s = await track(octoprint.start({ apiKey: KEY }));
    const made = await read<{ printer: { id: number } }>(await addPrinter(json("POST", { name: "ZZ Conn Octo", family: "octoprint", access: { address: s.url, apiKey: KEY } })));
    const r = await test({ kind: "printer", id: made.body.printer.id });
    expect(r.body).toMatchObject({ ok: true, message: "OctoPrint answered: OctoPrint 2.0.0.", detail: { server: "2.0.0" } });
    expect(s.requests.map((x) => [x.method, x.path, x.headers["x-api-key"]])).toEqual([["GET", "/api/version", KEY]]);
  });

  it("tests before saving, and a changed key on a saved printer", async () => {
    const s = await track(octoprint.start({ apiKey: KEY }));
    expect((await test({ kind: "printer", family: "octoprint", access: { address: s.url, apiKey: KEY } })).body.ok).toBe(true);
    const wrong = await test({ kind: "printer", family: "octoprint", access: { address: s.url, apiKey: "wrong-octo-key-000000" } });
    expect(wrong.body).toMatchObject({ ok: false, message: "OctoPrint refused the key (HTTP 403). Check the key." });

    const made = await read<{ printer: { id: number } }>(await addPrinter(json("POST", { name: "ZZ Conn Octo 2", family: "octoprint", access: { address: s.url, apiKey: "old-octo-key-000000000" } })));
    expect((await test({ kind: "printer", id: made.body.printer.id })).body.ok).toBe(false);
    expect((await test({ kind: "printer", id: made.body.printer.id, access: { apiKey: KEY } })).body.ok).toBe(true);
    // the test changed nothing saved
    expect((await q<{ access: { apiKey: string } }>("SELECT access FROM printers WHERE id=$1", [made.body.printer.id]))[0].access.apiKey).toBe("old-octo-key-000000000");
  });

  it("explains a server error and a timeout", async () => {
    const s = await track(octoprint.start({ failWith: 502 }));
    const access = { address: s.url, apiKey: KEY };
    expect((await test({ kind: "printer", family: "octoprint", access })).body.message).toBe("OctoPrint answered with a server error (HTTP 502).");
    s.set({ failWith: undefined, delayMs: 2000 });
    setConnectionTestLimit(150);
    expect((await test({ kind: "printer", family: "octoprint", access })).body).toEqual({ ok: false, message: "No answer within 150 ms." });
  });

  it("tests Moonraker with GET /printer/info, with and without a key", async () => {
    const open = await track(moonraker.start());
    const r = await test({ kind: "printer", family: "moonraker", access: { address: open.url } });
    expect(r.body).toMatchObject({ ok: true, message: "Moonraker answered; Klipper is ready.", detail: { state: "ready" } });
    expect(open.requests[0].path).toBe("/printer/info");
    expect(open.requests[0].headers["x-api-key"]).toBeUndefined();

    const locked = await track(moonraker.start({ apiKey: "moon-key-0000000000" }));
    expect((await test({ kind: "printer", family: "moonraker", access: { address: locked.url } })).body.message).toMatch(/refused the key \(HTTP 401\)/);
    expect((await test({ kind: "printer", family: "moonraker", access: { address: locked.url, apiKey: "moon-key-0000000000" } })).body.ok).toBe(true);
    locked.set({ failWith: 500 });
    expect((await test({ kind: "printer", family: "moonraker", access: { address: locked.url, apiKey: "moon-key-0000000000" } })).body.message).toMatch(/server error/);
  });

  it("file-only is always ok; planned families are not built yet", async () => {
    expect((await test({ kind: "printer", family: "file-only" })).body.ok).toBe(true);
    const r = await test({ kind: "printer", family: "prusalink", access: { address: "http://prusa.invalid", username: "maker", password: "pw" } });
    expect(r.body).toEqual({ ok: false, message: "A connection test for Prusa (PrusaLink) is not built yet." });
    expect((await test({ kind: "printer", family: "elegoo" })).body.message).toMatch(/not built yet/);
  });

  it("validates, and answers 404 for an unknown printer", async () => {
    expect((await test({ kind: "printer", id: 99999999 })).status).toBe(404);
    expect((await test({ kind: "printer" })).body.issues?.[0].field).toBe("id");
    expect((await test({ kind: "printer", family: "makerbot" })).body.issues?.[0].field).toBe("family");
    expect((await test({ kind: "printer", family: "octoprint", access: { address: "http://o.local" } })).body.issues?.[0].field).toBe("access.apiKey");
  });
});

describe("kind: planner", () => {
  it("checks the given address, then the saved one, then says none is set", async () => {
    const url = inject("plannerUrl");
    expect((await test({ kind: "planner", url })).body).toMatchObject({ ok: true, detail: { url } });
    expect((await test({ kind: "planner" })).body).toEqual({ ok: false, message: "No planner address is saved and PLANNER_URL is not set." });
    await putSettings(json("PUT", { plannerUrl: url }));
    expect((await test({ kind: "planner" })).body.ok).toBe(true);
  });

  it("explains something that is not the planner, a server error and a timeout", async () => {
    const s = await track(octoprint.start());
    expect((await test({ kind: "planner", url: s.url })).body.message).toMatch(/HTTP 404/);
    s.set({ failWith: 500 });
    expect((await test({ kind: "planner", url: s.url })).body.message).toBe("The planner answered with a server error (HTTP 500).");
    s.set({ failWith: undefined, delayMs: 2000 });
    setConnectionTestLimit(150);
    expect((await test({ kind: "planner", url: s.url })).body.message).toBe("No answer within 150 ms.");
  });
});

describe("kind: database", () => {
  it("reports the connection, the version and pgvector", async () => {
    const r = await test({ kind: "database" });
    expect(r.body.ok).toBe(true);
    expect(r.body.detail).toMatchObject({ connected: true, version: expect.stringMatching(/^\d+/) });
    expect(typeof r.body.detail!.vector).toBe("boolean");
  });
});

describe("audit of tests", () => {
  it("records each test with its result and no values", async () => {
    await test({ kind: "perplexity", apiKey: "pplx-audit-secret-0000" });
    await test({ kind: "database" });
    await test({ kind: "printer", family: "file-only" });
    const entries = (await readAudit()).slice(0, 3);
    expect(entries.map((e) => [e.action, e.provider, e.result?.ok])).toEqual([
      ["tested", "printer:file-only", true],
      ["tested", "database", true],
      ["tested", "perplexity", false],
    ]);
    expect(JSON.stringify(await readAudit())).not.toContain("pplx-audit-secret-0000");
  });
});
