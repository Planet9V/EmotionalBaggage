// Admin, Voice-overs against a stand-in for OpenRouter's speech API, as the project manager read its documentation
// on 22 Nov 2026 (this machine cannot reach openrouter.ai): GET /api/v1/models?output_modalities=speech (each model
// with supported_voices and pricing), GET /api/v1/audio/speech/models (supported parameters) and POST
// /api/v1/audio/speech. It checks what each kind of model is sent: the direction as instructions, as OpenAI provider
// options, or as bracket cues in the line, and never the direction read out as text. Nothing here is checked
// against the real service.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool, q } from "@/lib/db";
import { PUT as settingsPut } from "@/app/api/admin/settings/route";
import { PUT as credPut } from "@/app/api/admin/credentials/[provider]/route";
import { POST as act } from "@/app/api/admin/voiceovers/route";
import { GET as modelsGet } from "@/app/api/admin/voiceovers/models/route";
import { setServiceBaseForTests } from "@/lib/secretOrigin";
import { VOICEOVERS_KEY, readVoiceovers } from "@/lib/voice/voiceovers";
import { VOICE_CUES } from "@/components/welcome/scenes/voiceScript";
import { CUE_DIRECTIONS, SPEAKER_NOTE } from "@/components/welcome/scenes/voiceDirections";
import { json, read } from "../api/helpers";
import { toneWav } from "./helpers";

const hook = vi.hoisted(() => ({ admin: true }));
vi.mock("@/lib/admin/platformAdminHook", () => ({ platformAdminFromAuth2: async () => hook.admin }));

const KEY = "sk-or-v1-voice-takes-0000000000";
const OPENAI = "openai/gpt-4o-mini-tts-2025-12-15";
const FISH = "fishaudio/s2.1-pro";
const MAI = "microsoft/mai-voice-2";
type Seen = { method: string; url: string; auth: string | undefined; body: string };
const seen: Seen[] = [];
let listParams = true;
let srv: Server;
let base = "";

const models = () => ({
  data: [
    { id: OPENAI, supported_voices: ["nova", "coral"], pricing: { prompt: "0.0000006" } },
    { id: FISH, supported_voices: ["bright-woman"], pricing: { input_character: "0.000015" } },
    { id: MAI, supported_voices: ["Jasper"], pricing: { per_character: "0.00002" } },
  ],
});
const speechModels = () => ({ data: listParams ? [{ id: OPENAI, supported_parameters: ["voice", "instructions", "speed", "response_format"] }, { id: FISH, supported_parameters: ["voice", "response_format"] }, { id: MAI, supported_parameters: ["voice"] }] : [] });

const call = (h: (r: Request, c: never) => Promise<Response>, method: string, path: string, body?: unknown, ctx?: unknown) => h(json(method, body, `http://test.local${path}`), ctx as never);
const post = (body: unknown) => act(json("POST", body, "http://test.local/api/admin/voiceovers"));
const spoken = () => seen.filter((s) => s.method === "POST" && s.url === "/api/v1/audio/speech").map((s) => JSON.parse(s.body) as Record<string, unknown>);

let saved: { settings: unknown[]; creds: unknown[] };
beforeAll(async () => {
  saved = { settings: await q("SELECT key, value FROM settings WHERE key IN ('voice.tts', 'models.reasoning', $1)", [VOICEOVERS_KEY]), creds: await q("SELECT 1 FROM credentials WHERE provider='openrouter'") };
  srv = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", auth: req.headers.authorization, body });
      if (req.headers.authorization !== `Bearer ${KEY}`) return void res.writeHead(401).end("{}");
      if (req.method === "POST" && req.url === "/api/v1/audio/speech") return void res.writeHead(200, { "content-type": "audio/wav" }).end(Buffer.from(toneWav([0, 1, 1, 0.5, 0])));
      if (req.url === "/api/v1/models?output_modalities=speech") return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(models()));
      if (req.url === "/api/v1/audio/speech/models") return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(speechModels()));
      res.writeHead(404).end("{}");
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/v1`;
  setServiceBaseForTests("openrouter", base);
  expect((await call(settingsPut, "PUT", "/api/admin/settings", { reasoningModel: { provider: "openrouter", baseUrl: base, model: "openai/gpt-4o-mini" } })).status).toBe(200);
  expect((await call(credPut, "PUT", "/api/admin/credentials/openrouter", { fields: { apiKey: KEY }, address: base }, { params: Promise.resolve({ provider: "openrouter" }) })).status).toBe(200);
  expect((await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "openrouter", model: OPENAI, voice: "nova" } })).status).toBe(200);
});
beforeEach(() => {
  hook.admin = true;
  listParams = true;
  seen.length = 0;
});
afterAll(async () => {
  setServiceBaseForTests("openrouter", null);
  await q("DELETE FROM files WHERE kind='voiceover' AND meta->>'state'='take'");
  await q("DELETE FROM settings WHERE key IN ('voice.tts', 'models.reasoning')");
  for (const r of saved.settings as { key: string; value: unknown }[]) await q("INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [r.key, JSON.stringify(r.value)]);
  if (!saved.settings.some((r) => (r as { key: string }).key === VOICEOVERS_KEY)) await q("DELETE FROM settings WHERE key=$1", [VOICEOVERS_KEY]);
  if (!saved.creds.length) await q("DELETE FROM credentials WHERE provider='openrouter'");
  await new Promise((r) => srv.close(() => r(undefined)));
  await pool().end();
});

describe("Admin, Voice-overs with OpenRouter", () => {
  it("lists the live speech models with their voices, parameters, prices and how each takes a direction", async () => {
    const r = await read<{ ok: boolean; models: { id: string; voices: string[]; parameters: string[]; pricePerChar: number | null; mode: string }[] }>(await modelsGet(json("GET", undefined, "http://test.local/api/admin/voiceovers/models")));
    expect(r.status).toBe(200);
    expect(r.body.models.map((m) => [m.id, m.mode, m.pricePerChar])).toEqual([
      [OPENAI, "instructions", null],
      [FISH, "inline", 0.000015],
      [MAI, "inline", 0.00002],
    ]);
    expect(r.body.models[0]!.parameters).toContain("instructions");
    expect(seen.map((s) => s.url).sort()).toEqual(["/api/v1/audio/speech/models", "/api/v1/models?output_modalities=speech"]);
  });

  it("a model that lists instructions is sent the subtitle as written and the speaker's note and direction beside it, for every take", async () => {
    const r = await read<{ via: string; takes: unknown[] }>(await post({ action: "generate", cue: "scale-fat", speed: 1.1 }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ via: "instructions" });
    expect(r.body.takes).toHaveLength(3);
    const sent = spoken();
    expect(sent).toHaveLength(3);
    for (const b of sent) {
      expect(b).toEqual({ model: OPENAI, voice: "nova", input: "Are you... calling me FAT?", response_format: "mp3", speed: 1.1, instructions: `${SPEAKER_NOTE.bag}\n\n${CUE_DIRECTIONS["scale-fat"]!.direction}` });
    }
    const take = (await readVoiceovers()).takes["scale-fat"]!.at(-1)!;
    expect(take).toMatchObject({ via: "instructions", say: "Are you... calling me FAT?", model: OPENAI, direction: expect.stringContaining("wounded shriek") });
  });

  it("an OpenAI model whose parameters are not listed gets the direction as provider options, and no speed", async () => {
    listParams = false;
    await post({ action: "generate", cue: "scale-limit", count: 1, speed: 1.2 });
    const [b] = spoken();
    expect(b).toEqual({ model: OPENAI, voice: "nova", input: "Sir, the bag is over the limit.", response_format: "mp3", provider: { options: { openai: { instructions: `${SPEAKER_NOTE.agent}\n\n${CUE_DIRECTIONS["scale-limit"]!.direction}` } } } });
  });

  it("Fish is sent the bracket cues in the line and no instructions; the long direction is never in the text", async () => {
    await post({ action: "generate", cue: "toss-ow", count: 2, model: FISH, voice: "bright-woman" });
    const sent = spoken();
    expect(sent).toHaveLength(2);
    for (const b of sent) {
      expect(b).toEqual({ model: FISH, voice: "bright-woman", input: CUE_DIRECTIONS["toss-ow"]!.inlineTags, response_format: "mp3" });
      expect(String(b.input)).not.toContain("Do not");
      expect(String(b.input)).not.toContain(SPEAKER_NOTE.bag.slice(0, 30));
    }
  });

  it("the administrator's choice of mode is followed: none sends the plain subtitle with no brackets and no instructions", async () => {
    await post({ action: "generate", cue: "carousel-stranger", count: 1, model: MAI, voice: "Jasper", mode: "none" });
    expect(spoken()[0]).toEqual({ model: MAI, voice: "Jasper", input: "Where did you get that?", response_format: "mp3" });
    await post({ action: "generate", cue: "carousel-stranger", count: 1, model: MAI, voice: "Jasper", mode: "instructions" });
    expect(spoken()[1]).toMatchObject({ model: MAI, input: "Where did you GET that?", instructions: expect.stringContaining("half laughing") });
  });

  it("a speaker's cast and character note apply to all their lines", async () => {
    expect((await post({ action: "cast", speaker: "bag", model: FISH, voice: "bright-woman", speed: 1, prefix: "A tiny, furious suitcase." })).status).toBe(200);
    await post({ action: "generate", cue: "hold-dark", count: 1 });
    expect(spoken()[0]).toMatchObject({ model: FISH, input: CUE_DIRECTIONS["hold-dark"]!.inlineTags });
    await post({ action: "generate", cue: "hold-dark", count: 1, model: OPENAI, voice: "coral" });
    expect(spoken()[1]!.instructions).toBe(`A tiny, furious suitcase.\n\n${CUE_DIRECTIONS["hold-dark"]!.direction}`);
  });

  it("estimates the cost first, from the price per character, and says unknown when a model has none; nothing is spoken", async () => {
    // the bag is cast on Fish (priced); the other speakers use the saved OpenAI model (no price per character)
    const all = await read<{ cost: number | null; takes: number; lines: { cue: string; model: string; cost: number | null; characters: number }[] }>(await post({ action: "estimate", count: 2 }));
    expect(all.status).toBe(200);
    expect(all.body.takes).toBe(VOICE_CUES.length * 2);
    expect(all.body.cost).toBeNull();
    const bag = all.body.lines.filter((l) => l.model === FISH);
    expect(bag.length).toBeGreaterThan(0);
    for (const l of bag) expect(l.cost).toBeCloseTo(CUE_DIRECTIONS[l.cue]!.inlineTags.length * 2 * 0.000015, 10);
    const bagOnly = await read<{ cost: number | null }>(await post({ action: "estimate", count: 1, cues: ["scale-fat", "toss-ow"] }));
    expect(bagOnly.body.cost).toBeCloseTo((CUE_DIRECTIONS["scale-fat"]!.inlineTags.length + CUE_DIRECTIONS["toss-ow"]!.inlineTags.length) * 0.000015, 10);
    expect(spoken()).toHaveLength(0);
  });

  it("non-administrators may not list models, generate or estimate", async () => {
    hook.admin = false;
    expect((await modelsGet(json("GET", undefined, "http://test.local/api/admin/voiceovers/models"))).status).toBe(403);
    expect((await post({ action: "generate", cue: "scale-fat" })).status).toBe(403);
    expect((await post({ action: "estimate" })).status).toBe(403);
    expect(seen).toHaveLength(0);
  });
});
