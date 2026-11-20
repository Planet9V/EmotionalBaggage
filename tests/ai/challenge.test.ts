// The reviewer route end to end through the OpenAI-compatible stand-in.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET, POST } from "@/app/api/challenge/route";
import { start } from "../standins/openai";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows, saveKey } from "./setup";

const PROJECT = "zz-ai-challenge";
const savedEnv = process.env.OPENROUTER_API_KEY;
let s: StandIn<OpenAIOptions>;

type State = { configured: boolean; model: string; messages: { role: string; content: string }[] };
const state = async () => read<State>(await GET(json("GET", undefined, `http://t/api/challenge?projectId=${PROJECT}`)));
const send = (message: string) => POST(json("POST", { projectId: PROJECT, message }));

beforeAll(async () => {
  delete process.env.OPENROUTER_API_KEY;
  s = await start({ prefix: "/v1", reply: "Who pays for it, and why now?" });
  await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ AI Challenge', 'A bag that weighs itself')", [PROJECT]);
  await q("INSERT INTO items (project_id, section, title, body) VALUES ($1, 'concept/brief', 'Travellers over 50 kg', 'Frequent flyers')", [PROJECT]);
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
  await s.close();
  if (savedEnv !== undefined) process.env.OPENROUTER_API_KEY = savedEnv;
  await pool().end();
});

beforeEach(async () => {
  await clearModelRows();
  s.requests.length = 0;
});

describe("reviewer", () => {
  it("GET says not configured, with no model name, when no reasoning model is chosen", async () => {
    const r = await state();
    expect(r.status).toBe(200);
    expect(r.body.configured).toBe(false);
    expect(r.body.model).toBe("");
    expect(Array.isArray(r.body.messages)).toBe(true);
  });

  it("GET says not configured when OpenRouter is chosen without a key", async () => {
    await chooseReasoning({ provider: "openrouter", baseUrl: `${s.url}/api/v1`, model: "x/y" });
    expect((await state()).body).toMatchObject({ configured: false, model: "" });
    await saveKey("openrouter", "sk-or-test-0123456789");
    expect((await state()).body).toMatchObject({ configured: true, model: "x/y" });
  });

  it("POST answers 503 with the model layer's sentence when not configured, and stores nothing", async () => {
    const res = await send("Is this a business?");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
    expect(s.requests).toHaveLength(0);
    expect(await q("SELECT 1 FROM messages WHERE project_id=$1", [PROJECT])).toHaveLength(0);
  });

  it("GET shows the chosen model; POST asks the stand-in and stores both turns", async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "qwen-reviewer" });
    expect((await state()).body).toMatchObject({ configured: true, model: "qwen-reviewer" });

    const res = await read<{ reply: string }>(await send("Is this a business?"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "Who pays for it, and why now?" });

    expect(s.requests).toHaveLength(1);
    const req = s.requests[0];
    expect(req.path).toBe("/v1/chat/completions");
    const b = req.body as { model: string; max_tokens: number; messages: { role: string; content: string }[] };
    expect(b.model).toBe("qwen-reviewer");
    expect(b.max_tokens).toBe(1200);
    expect(b.messages[0].role).toBe("system");
    expect(b.messages[0].content).toContain("You review product concepts");
    expect(b.messages[0].content).toContain("Concept: ZZ AI Challenge. A bag that weighs itself");
    expect(b.messages[0].content).toContain("[concept/brief | open] Travellers over 50 kg: Frequent flyers");
    expect(b.messages.at(-1)).toEqual({ role: "user", content: "Is this a business?" });
    expect(req.headers.authorization).toBeUndefined();

    const after = (await state()).body.messages.map((m) => [m.role, m.content]);
    expect(after).toEqual([
      ["user", "Is this a business?"],
      ["assistant", "Who pays for it, and why now?"],
    ]);

    // The next turn carries the history.
    s.requests.length = 0;
    await send("Frequent flyers pay.");
    const b2 = s.requests[0].body as { messages: { role: string; content: string }[] };
    expect(b2.messages.slice(1).map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("POST answers the provider's failure as a plain 502 and stores nothing", async () => {
    await q("DELETE FROM messages WHERE project_id=$1", [PROJECT]);
    await chooseReasoning({ provider: "lmstudio", baseUrl: `${s.url}/v1`, model: "m" });
    s.set({ failWith: 401 });
    try {
      const res = await send("hello");
      expect(res.status).toBe(502);
      expect((await res.json()).error).toMatch(/^LM Studio answered HTTP 401/);
      expect(await q("SELECT 1 FROM messages WHERE project_id=$1", [PROJECT])).toHaveLength(0);
    } finally {
      s.set({ failWith: undefined });
    }
  });

  it("has nothing vendor-specific left in the route", () => {
    const src = readFileSync(join(process.cwd(), "src/app/api/challenge/route.ts"), "utf8");
    expect(src).not.toMatch(/anthropic|claude|openai\.com|openrouter\.ai|process\.env/i);
  });
});
