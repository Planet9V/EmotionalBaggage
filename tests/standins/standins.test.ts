import { afterEach, describe, expect, it } from "vitest";
import type { MultipartBody, StandIn } from "./core";
import * as openai from "./openai";
import * as perplexity from "./perplexity";
import * as octoprint from "./octoprint";
import * as moonraker from "./moonraker";
import { json } from "../api/helpers";

// Every stand-in started in a test is closed after it, even when the test fails.
const running: StandIn<unknown>[] = [];
async function track<T extends StandIn<never>>(p: Promise<T>): Promise<T> {
  const s = await p;
  running.push(s as unknown as StandIn<unknown>);
  return s;
}
afterEach(async () => {
  await Promise.all(running.splice(0).map((s) => s.close()));
});

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

const gcode = () => new Blob(["G28\nG1 X10 Y10\n"], { type: "application/octet-stream" });

describe("OpenAI-compatible stand-in", () => {
  for (const prefix of ["/v1", "/api/v1"]) {
    it(`serves models, chat and embeddings under ${prefix}`, async () => {
      const s = await track(openai.start({ prefix, models: ["m-chat", "m-embed"] }));
      const models = await (await fetch(`${s.url}${prefix}/models`)).json();
      expect(models).toMatchObject({ object: "list", data: [{ id: "m-chat", object: "model" }, { id: "m-embed", object: "model" }] });

      const chat = await post(`${s.url}${prefix}/chat/completions`, { model: "m-chat", messages: [{ role: "user", content: "hello there" }] });
      expect(chat.status).toBe(200);
      const c = await chat.json();
      expect(c.object).toBe("chat.completion");
      expect(c.model).toBe("m-chat");
      expect(c.choices[0].message).toMatchObject({ role: "assistant", content: "Echo: hello there" });
      expect(c.choices[0].finish_reason).toBe("stop");

      // the wrong prefix is not served
      expect((await fetch(`${s.url}${prefix === "/v1" ? "/api/v1" : "/v1"}/models`)).status).toBe(404);
    });
  }

  it("streams chat as Server-Sent Events ending with [DONE]", async () => {
    const s = await track(openai.start({ reply: "one two three" }));
    const res = await post(`${s.url}/v1/chat/completions`, { model: "x", stream: true, messages: [{ role: "user", content: "hi" }] });
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await res.text();
    const events = text.split("\n\n").filter(Boolean).map((e) => e.replace(/^data: /, ""));
    expect(events.at(-1)).toBe("[DONE]");
    const chunks = events.slice(0, -1).map((e) => JSON.parse(e));
    expect(chunks.every((ch) => ch.object === "chat.completion.chunk")).toBe(true);
    expect(chunks[0].choices[0].delta.role).toBe("assistant");
    expect(chunks.map((ch) => ch.choices[0].delta.content ?? "").join("")).toBe("one two three");
    expect(chunks.at(-1).choices[0].finish_reason).toBe("stop");
  });

  it("returns one deterministic vector per input, of the configured or requested dimension", async () => {
    const s = await track(openai.start({ dimensions: 16 }));
    const r = await (await post(`${s.url}/v1/embeddings`, { model: "e", input: ["alpha", "beta"] })).json();
    expect(r.object).toBe("list");
    expect(r.data).toHaveLength(2);
    expect(r.data[0]).toMatchObject({ object: "embedding", index: 0 });
    expect(r.data[0].embedding).toEqual(openai.embeddingFor("alpha", 16));
    expect(r.data[1].embedding).toEqual(openai.embeddingFor("beta", 16));
    expect(r.data[0].embedding).not.toEqual(r.data[1].embedding);
    const norm = Math.sqrt(r.data[0].embedding.reduce((a: number, v: number) => a + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);

    const one = await (await post(`${s.url}/v1/embeddings`, { input: "alpha", dimensions: 1024 })).json();
    expect(one.data).toHaveLength(1);
    expect(one.data[0].embedding).toHaveLength(1024);
    expect(one.data[0].embedding.slice(0, 16)).not.toEqual(r.data[0].embedding); // normalised over its own length
    expect((await post(`${s.url}/v1/embeddings`, { input: [1, 2] })).status).toBe(400);
  });

  it("checks the Bearer key only when one is configured", async () => {
    const open = await track(openai.start());
    expect((await fetch(`${open.url}/v1/models`, { headers: { authorization: "Bearer anything" } })).status).toBe(200);

    const s = await track(openai.start({ apiKey: "sk-right" }));
    expect((await fetch(`${s.url}/v1/models`)).status).toBe(401);
    const wrong = await fetch(`${s.url}/v1/models`, { headers: { authorization: "Bearer sk-wrong" } });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error.code).toBe("invalid_api_key");
    expect((await fetch(`${s.url}/v1/models`, { headers: { authorization: "Bearer sk-right" } })).status).toBe(200);
  });

  it("forces a status on one path or all, and can be changed while running", async () => {
    const s = await track(openai.start({ failWith: 500, failPath: "/v1/embeddings" }));
    expect((await post(`${s.url}/v1/embeddings`, { input: "x" })).status).toBe(500);
    expect((await fetch(`${s.url}/v1/models`)).status).toBe(200);
    s.set({ failPath: undefined, failWith: 503 });
    expect((await fetch(`${s.url}/v1/models`)).status).toBe(503);
    s.set({ failWith: undefined });
    expect((await fetch(`${s.url}/v1/models`)).status).toBe(200);
  });

  it("delays answers so callers can test their timeouts", async () => {
    const s = await track(openai.start({ delayMs: 2000 }));
    const t0 = Date.now();
    await expect(fetch(`${s.url}/v1/models`, { signal: AbortSignal.timeout(150) })).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(1500);
    s.set({ delayMs: 50 });
    expect((await fetch(`${s.url}/v1/models`)).status).toBe(200);
  });

  it("records method, path, query, headers and parsed body of every request", async () => {
    const s = await track(openai.start({ apiKey: "k" }));
    await post(`${s.url}/v1/chat/completions?trace=1`, { model: "m", messages: [{ role: "user", content: "q" }] }, { authorization: "Bearer k", "x-extra": "yes" });
    await fetch(`${s.url}/v1/models`); // rejected with 401, still recorded
    expect(s.requests).toHaveLength(2);
    const [first, second] = s.requests;
    expect(first.method).toBe("POST");
    expect(first.path).toBe("/v1/chat/completions");
    expect(first.query).toEqual({ trace: "1" });
    expect(first.headers.authorization).toBe("Bearer k");
    expect(first.headers["x-extra"]).toBe("yes");
    expect(first.body).toEqual({ model: "m", messages: [{ role: "user", content: "q" }] });
    expect(second).toMatchObject({ method: "GET", path: "/v1/models", body: null });
  });
});

describe("Perplexity stand-in", () => {
  const auth = { authorization: "Bearer pk" };

  it("answers POST /v1/agent with a search_results item and a message, and requires the Bearer key", async () => {
    const s = await track(perplexity.start({ apiKey: "pk", reply: "The answer[1].", citations: ["https://a.example/1"], costUsd: 0.0021 }));
    const ok = await post(`${s.url}/v1/agent`, { effort: "fast", input: "q?" }, auth);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-request-id")).toBeTruthy();
    const b = await ok.json();
    expect(b).toMatchObject({ object: "response", status: "completed", model: "openai/gpt-6-luna", effort: "fast@2026-10-16.0" });
    expect(b.output[0]).toMatchObject({ type: "search_results", results: [{ id: 1, url: "https://a.example/1", title: "Stand-in source 1" }] });
    expect(b.output[1]).toMatchObject({ type: "message", role: "assistant", content: [{ type: "output_text", text: "The answer[1]." }] });
    expect(b.usage.cost.total_cost).toBe(0.0021);
    expect(b.choices).toBeUndefined();

    expect((await post(`${s.url}/v1/agent`, { input: "x" })).status).toBe(401);
    const wrong = await post(`${s.url}/v1/agent`, { input: "x" }, { authorization: "Bearer nope" });
    expect(wrong.status).toBe(401);
    expect(typeof (await wrong.json()).error.message).toBe("string");
    expect((await post(`${s.url}/v1/sonar`, { model: "sonar", messages: [] }, auth)).status).toBe(404);
    expect((await post(`${s.url}/v1/agent`, { effort: "fast" }, auth)).status).toBe(400);
    expect(s.requests[0].body).toEqual({ effort: "fast", input: "q?" });
  });

  it("can leave sources out, rate limit, fail a run, send malformed bodies, force a status and delay", async () => {
    const s = await track(perplexity.start({ apiKey: "pk", noSources: true }));
    const b = await (await post(`${s.url}/v1/agent`, { input: "x" }, auth)).json();
    expect(b.output.map((o: { type: string }) => o.type)).toEqual(["message"]);
    expect(b.effort).toBeUndefined();

    s.set({ rateLimit: "request_rate_limit_exceeded" });
    const limited = await post(`${s.url}/v1/agent`, { input: "x" }, auth);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
    expect((await limited.json()).error.type).toBe("request_rate_limit_exceeded");

    s.set({ rateLimit: undefined, failedRun: true });
    expect(await (await post(`${s.url}/v1/agent`, { input: "x" }, auth)).json()).toMatchObject({ status: "failed", error: { message: expect.any(String) } });

    s.set({ failedRun: false, malformed: "not-json" });
    expect(await (await post(`${s.url}/v1/agent`, { input: "x" }, auth)).text()).toMatch(/not json/);
    s.set({ malformed: "no-output" });
    expect((await (await post(`${s.url}/v1/agent`, { input: "x" }, auth)).json()).output).toBeUndefined();

    s.set({ malformed: undefined, failWith: 500 });
    expect((await post(`${s.url}/v1/agent`, { input: "x" }, auth)).status).toBe(500);
    s.set({ failWith: undefined, delayMs: 2000 });
    await expect(
      fetch(`${s.url}/v1/agent`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: "{}", signal: AbortSignal.timeout(150) }),
    ).rejects.toThrow();
  });
});

describe("OctoPrint stand-in", () => {
  it("reports its version and an idle job", async () => {
    const s = await track(octoprint.start());
    expect(await (await fetch(`${s.url}/api/version`)).json()).toEqual({ server: "2.0.0", text: "OctoPrint 2.0.0" });
    const job = await (await fetch(`${s.url}/api/job`)).json();
    expect(job.state).toBe("Operational");
    expect(job.job.file.name).toBeNull();
  });

  it("uploads with select, then starts the job; a second start is refused", async () => {
    const s = await track(octoprint.start({ apiKey: "ok" }));
    const form = new FormData();
    form.append("file", gcode(), "part.gcode");
    form.append("select", "true");
    const up = await fetch(`${s.url}/api/files/local`, { method: "POST", headers: { "X-Api-Key": "ok" }, body: form });
    expect(up.status).toBe(201);
    expect(up.headers.get("location")).toBe(`${s.url}/api/files/local/part.gcode`);
    expect(await up.json()).toMatchObject({ file: { name: "part.gcode", path: "part.gcode", origin: "local" }, done: true, effectiveSelect: true, effectivePrint: false });

    const rec = s.requests[0].body as MultipartBody;
    expect(rec.kind).toBe("multipart");
    expect(rec.fields.select).toBe("true");
    expect(rec.files[0]).toMatchObject({ field: "file", filename: "part.gcode" });
    expect(rec.files[0].content.toString()).toBe("G28\nG1 X10 Y10\n");

    const start = await post(`${s.url}/api/job`, { command: "start" }, { authorization: "Bearer ok" });
    expect(start.status).toBe(204);
    expect(await start.text()).toBe("");
    const job = await (await fetch(`${s.url}/api/job`, { headers: { "X-Api-Key": "ok" } })).json();
    expect(job).toMatchObject({ state: "Printing", job: { file: { name: "part.gcode", origin: "local" } } });
    expect(typeof job.progress.completion).toBe("number");
    expect((await post(`${s.url}/api/job`, { command: "start" }, { "X-Api-Key": "ok" })).status).toBe(409);
    expect((await post(`${s.url}/api/job`, { command: "cancel" }, { "X-Api-Key": "ok" })).status).toBe(204);
  });

  it("starts printing on upload with print=true, unless the printer is not operational", async () => {
    const s = await track(octoprint.start());
    const form = new FormData();
    form.append("file", gcode(), "a.gcode");
    form.append("print", "true");
    form.append("path", "jobs/");
    const r = await (await fetch(`${s.url}/api/files/local`, { method: "POST", body: form })).json();
    expect(r).toMatchObject({ file: { path: "jobs/a.gcode" }, effectiveSelect: true, effectivePrint: true });
    expect((await (await fetch(`${s.url}/api/job`)).json()).state).toBe("Printing");

    const down = await track(octoprint.start({ operational: false }));
    const f2 = new FormData();
    f2.append("file", gcode(), "b.gcode");
    f2.append("print", "true");
    expect(await (await fetch(`${down.url}/api/files/local`, { method: "POST", body: f2 })).json()).toMatchObject({ effectiveSelect: false, effectivePrint: false });
  });

  it("refuses bad uploads, bad commands and wrong keys", async () => {
    const s = await track(octoprint.start({ apiKey: "k" }));
    const h = { "X-Api-Key": "k" };
    expect((await fetch(`${s.url}/api/files/local`, { method: "POST", headers: h, body: new FormData() })).status).toBe(400);
    const txt = new FormData();
    txt.append("file", new Blob(["x"]), "notes.txt");
    expect((await fetch(`${s.url}/api/files/local`, { method: "POST", headers: h, body: txt })).status).toBe(415);
    const f = new FormData();
    f.append("file", gcode(), "a.gcode");
    expect((await fetch(`${s.url}/api/files/sdcard9`, { method: "POST", headers: h, body: f })).status).toBe(404);
    expect((await post(`${s.url}/api/job`, { command: "start" }, h)).status).toBe(409); // nothing selected
    expect((await post(`${s.url}/api/job`, { command: "dance" }, h)).status).toBe(400);
    expect((await fetch(`${s.url}/api/job`)).status).toBe(403);
    expect((await fetch(`${s.url}/api/job`, { headers: { "X-Api-Key": "wrong" } })).status).toBe(403);
    s.set({ authFailureStatus: 401 });
    expect((await fetch(`${s.url}/api/job`, { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });

  it("forces failures and delays", async () => {
    const s = await track(octoprint.start({ failWith: 500, failPath: "/api/job" }));
    expect((await fetch(`${s.url}/api/job`)).status).toBe(500);
    expect((await fetch(`${s.url}/api/version`)).status).toBe(200);
    s.set({ failWith: undefined, delayMs: 2000 });
    await expect(fetch(`${s.url}/api/job`, { signal: AbortSignal.timeout(150) })).rejects.toThrow();
  });

  it("works with the app's printer route", async () => {
    const s = await track(octoprint.start({ apiKey: "pk" }));
    const form = new FormData();
    form.append("file", gcode(), "route.gcode");
    form.append("print", "true");
    await fetch(`${s.url}/api/files/local`, { method: "POST", headers: { "X-Api-Key": "pk" }, body: form });
    Object.assign(process.env, { PRINTER_KIND: "octoprint", PRINTER_URL: s.url, PRINTER_API_KEY: "pk" });
    try {
      const { GET } = await import("@/app/api/printer/route");
      const body = await (await GET(json("GET", undefined, "http://test.local/api/printer"))).json();
      expect(body).toMatchObject({ configured: true, kind: "octoprint", state: "Printing", file: "route.gcode", secondsLeft: 912 });
      expect(typeof body.progress).toBe("number");
      expect(s.requests.at(-1)?.headers["x-api-key"]).toBe("pk");
    } finally {
      delete process.env.PRINTER_KIND;
      delete process.env.PRINTER_URL;
      delete process.env.PRINTER_API_KEY;
    }
  });
});

describe("Moonraker stand-in", () => {
  it("reports printer info and idle print stats, wrapped in result", async () => {
    const s = await track(moonraker.start());
    const info = await (await fetch(`${s.url}/printer/info`)).json();
    expect(info.result).toMatchObject({ state: "ready", state_message: "Printer is ready" });
    const q = await (await fetch(`${s.url}/printer/objects/query?print_stats`)).json();
    expect(q.result.status.print_stats).toMatchObject({ state: "standby", filename: "" });
    expect(q.result.status.display_status).toBeUndefined();
    expect(typeof q.result.eventtime).toBe("number");
    const some = await (await fetch(`${s.url}/printer/objects/query?print_stats=state,filename,nope&missing_object`)).json();
    expect(some.result.status).toEqual({ print_stats: { state: "standby", filename: "" } });
  });

  it("uploads, starts the print with print=true and reports print_started", async () => {
    const s = await track(moonraker.start({ apiKey: "mk" }));
    const form = new FormData();
    form.append("file", gcode(), "cube.gcode");
    form.append("print", "true");
    const up = await fetch(`${s.url}/server/files/upload`, { method: "POST", headers: { "X-Api-Key": "mk" }, body: form });
    expect(up.status).toBe(201);
    expect(up.headers.get("location")).toBe(`${s.url}/server/files/gcodes/cube.gcode`);
    const b = await up.json();
    expect(b.result).toMatchObject({ item: { path: "cube.gcode", root: "gcodes", permissions: "rw" }, print_started: true, print_queued: false, action: "create_file" });
    expect(b.result.item.size).toBe(15);
    const q = await (await fetch(`${s.url}/printer/objects/query?print_stats&display_status`, { headers: { "X-Api-Key": "mk" } })).json();
    expect(q.result.status.print_stats).toMatchObject({ state: "printing", filename: "cube.gcode" });

    const plain = new FormData();
    plain.append("file", gcode(), "later.gcode");
    plain.append("path", "queue");
    const p = await (await fetch(`${s.url}/server/files/upload`, { method: "POST", headers: { "X-Api-Key": "mk" }, body: plain })).json();
    expect(p.result).toMatchObject({ item: { path: "queue/later.gcode" }, print_started: false });
    expect((s.requests.at(-1)?.body as MultipartBody).fields.path).toBe("queue");
  });

  it("refuses wrong keys and empty uploads; forces failures and delays", async () => {
    const s = await track(moonraker.start({ apiKey: "mk" }));
    expect((await fetch(`${s.url}/printer/info`)).status).toBe(401);
    expect((await fetch(`${s.url}/printer/info`, { headers: { "X-Api-Key": "bad" } })).status).toBe(401);
    expect((await fetch(`${s.url}/printer/info`, { headers: { authorization: "Bearer mk" } })).status).toBe(200);
    expect((await fetch(`${s.url}/server/files/upload`, { method: "POST", headers: { "X-Api-Key": "mk" }, body: new FormData() })).status).toBe(400);
    s.set({ failWith: 500 });
    expect((await fetch(`${s.url}/printer/info`, { headers: { "X-Api-Key": "mk" } })).status).toBe(500);
    s.set({ failWith: undefined, delayMs: 2000 });
    await expect(fetch(`${s.url}/printer/info`, { headers: { "X-Api-Key": "mk" }, signal: AbortSignal.timeout(150) })).rejects.toThrow();
  });

  it("works with the app's printer route", async () => {
    const s = await track(moonraker.start());
    const form = new FormData();
    form.append("file", gcode(), "route.gcode");
    form.append("print", "true");
    await fetch(`${s.url}/server/files/upload`, { method: "POST", body: form });
    Object.assign(process.env, { PRINTER_KIND: "moonraker", PRINTER_URL: s.url });
    try {
      const { GET } = await import("@/app/api/printer/route");
      const body = await (await GET(json("GET", undefined, "http://test.local/api/printer"))).json();
      expect(body).toMatchObject({ configured: true, kind: "moonraker", state: "printing", file: "route.gcode", progress: 0 });
      expect(Object.keys(s.requests.at(-1)?.query ?? {})).toEqual(expect.arrayContaining(["print_stats", "display_status"]));
    } finally {
      delete process.env.PRINTER_KIND;
      delete process.env.PRINTER_URL;
    }
  });
});
