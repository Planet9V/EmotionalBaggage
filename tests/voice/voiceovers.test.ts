// The voice-over clips of the welcome film against a real PostgreSQL: the clips that come with the example are stored
// once per batch and never replace a clip an administrator published; the public route serves only the published clip
// of a cue of the film (ranges, caching, no other file, no NUL); and the administrator's tool (generate, accept,
// discard, cast) is the platform administrator's only. The voice service is a stand-in synthesizer.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { NUL_REFUSED } from "@/lib/api/route";
import { PLATFORM_ADMIN_NOTICE } from "@/lib/admin/guard";
import { decodeAudio } from "@/lib/voice/decode";
import { decodeEnvelope, envelopeOf } from "@/lib/voice/envelope";
import { SEED_VOICEOVERS_DIR, readVoiceoverManifest, seedVoiceovers } from "@/lib/voice/seedVoiceovers";
import { VOICEOVERS_KEY, publicVoiceovers, readVoiceovers } from "@/lib/voice/voiceovers";
import { CAST, INTRO, INTRO_CUE, VOICE_CUES } from "@/components/welcome/scenes/voiceScript";
import { GET as serve } from "@/app/api/voiceovers/[cue]/route";
import { GET as list, POST as act } from "@/app/api/admin/voiceovers/route";
import { GET as takeGet } from "@/app/api/admin/voiceovers/take/[cue]/route";
import { anonymous, json, read } from "../api/helpers";
import { toneWav } from "./helpers";

// The platform administrator exists only in the new sign-in; here the hook is stood in (as tests/admin/platform.test.ts does).
const hook = vi.hoisted(() => ({ admin: true }));
vi.mock("@/lib/admin/platformAdminHook", () => ({ platformAdminFromAuth2: async () => hook.admin }));

// The voice service is a stand-in: it answers a short WAV and records what it was asked to say and with which voice.
const speech = vi.hoisted(() => ({ configured: true, asked: [] as { text: string; choice: Record<string, unknown> }[], audio: null as Uint8Array | null, type: "audio/wav" }));
vi.mock("@/lib/voice/speech", async (orig) => ({
  ...(await orig<typeof import("@/lib/voice/speech")>()),
  getVoiceSettings: async () => (speech.configured ? { configured: true, provider: "kokoro", baseUrl: "http://speech.test/v1", model: "kokoro", voice: "af_heart", speed: 1 } : { configured: false, reason: "No voice is set up, so narration is off. Choose a provider in Admin, Voice." }),
  getSpeechSynthesizer: async (choice: { model?: string; voice?: string; speed?: number } = {}) =>
    speech.configured
      ? {
          configured: true,
          settings: { provider: "kokoro", baseUrl: "http://speech.test/v1", model: choice.model ?? "kokoro", voice: choice.voice ?? "af_heart", speed: choice.speed ?? 1 },
          synth: {
            synthesize: async (text: string) => {
              speech.asked.push({ text, choice });
              return { audio: speech.audio!, contentType: speech.type };
            },
          },
        }
      : { configured: false, reason: "No voice is set up, so narration is off. Choose a provider in Admin, Voice." },
}));

const SEED = "baggage-claims";
const ctx = (cue: string) => ({ params: Promise.resolve({ cue }) });
const url = (cue: string, query = "") => `http://test.local/api/voiceovers/${cue}${query}`;
const get = (cue: string, query = "", headers: Record<string, string> = {}) => serve(new Request(url(cue, query), { headers }), ctx(cue));
const post = (body: unknown) => act(json("POST", body, "http://test.local/api/admin/voiceovers"));
const files = () => q<{ id: string; name: string; sha256: string; meta: { cue: string; state: string; folder: string; seed?: string; envelope: string; speaker: string; text: string; voice: string; seconds: number } }>("SELECT id, name, sha256, meta FROM files WHERE project_id=$1 AND kind='voiceover' ORDER BY id", [SEED]);
const events = () => q<{ data: { batch: string; stored: number } }>("SELECT data FROM events WHERE project_id=$1 AND kind='seed.voiceovers' ORDER BY id", [SEED]);
/** publicVoiceovers() is kept for a minute: move the clock past that to read what is saved now. */
const fresh = () => {
  vi.setSystemTime(Date.now() + 61_000);
  return publicVoiceovers();
};
/** As an install that has never had voice-overs. */
async function wipe() {
  await q("DELETE FROM files WHERE project_id=$1 AND kind='voiceover'", [SEED]);
  await q("DELETE FROM settings WHERE key=$1", [VOICEOVERS_KEY]);
  await q("DELETE FROM events WHERE project_id=$1 AND kind='seed.voiceovers'", [SEED]);
}

let manifest: NonNullable<Awaited<ReturnType<typeof readVoiceoverManifest>>>;

beforeAll(async () => {
  await ready();
  manifest = (await readVoiceoverManifest())!;
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  hook.admin = true;
  speech.configured = true;
  speech.asked = [];
  speech.audio = toneWav([0, 1, 0.5, 1, 0]);
  speech.type = "audio/wav";
});
afterAll(async () => {
  vi.useRealTimers();
  // leave the database as a fresh install has it
  await wipe();
  await seedVoiceovers(pool());
  await q("DELETE FROM audit_log WHERE action LIKE 'voiceover.%'").catch(() => undefined);
  await pool().end();
});

describe("the clips that come with the example", () => {
  it("are one MP3 per cue of the film, small, each matching its sha256, length and envelope", async () => {
    expect(manifest.clips.map((c) => c.cue).sort()).toEqual(VOICE_CUES.map((c) => c.key).sort());
    let total = 0;
    for (const c of manifest.clips) {
      const cue = VOICE_CUES.find((v) => v.key === c.cue)!;
      expect(c.text, c.cue).toBe(cue.text);
      expect(c.speaker).toBe(cue.who);
      expect(c.voice).toBe(CAST[cue.who].voice);
      const bytes = new Uint8Array(await readFile(join(process.cwd(), SEED_VOICEOVERS_DIR, c.file)));
      total += bytes.length;
      expect(bytes.length).toBe(c.size);
      // decoded here, in Node, the clip is as long as the manifest says and has the envelope stored with it
      const a = await decodeAudio(bytes);
      expect(a.mime).toBe("audio/mpeg");
      expect(Math.abs(a.seconds - c.seconds), c.cue).toBeLessThan(0.08);
      const stored = decodeEnvelope(c.envelope);
      const now = envelopeOf(a.samples, a.sampleRate);
      expect(Math.abs(stored.length - now.length)).toBeLessThanOrEqual(3);
      let off = 0;
      for (let i = 0; i < Math.min(stored.length, now.length); i++) off += Math.abs(stored[i]! - now[i]!);
      expect(off / stored.length / 255, c.cue).toBeLessThan(0.03);
      // the line fits the time its subtitle has
      if (cue.window !== null) expect(c.seconds, c.cue).toBeLessThanOrEqual(cue.window);
    }
    expect(total).toBeLessThan(1024 * 1024);
    // the introduction's subtitles are timed to its clip: the last line ends as the clip does
    const intro = manifest.clips.find((c) => c.cue === INTRO_CUE)!;
    expect(Math.abs(INTRO.lines.at(-1)!.end - intro.seconds)).toBeLessThan(0.1);
  });

  it("are in the files store on a fresh install, in the folder Voice-overs, published, each with its cue, speaker, words, voice, length and envelope", async () => {
    const doc = await readVoiceovers();
    const stored = await files();
    for (const c of manifest.clips) {
      const clip = doc.clips[c.cue]!;
      expect(clip, c.cue).toMatchObject({ sha256: c.sha256, seconds: c.seconds, envelope: c.envelope, speaker: c.speaker, text: c.text, voice: c.voice, seed: manifest.batch, mime: "audio/mpeg" });
      const f = stored.find((x) => Number(x.id) === clip.fileId)!;
      expect(f.sha256).toBe(c.sha256);
      expect(f.meta).toMatchObject({ folder: "Voice-overs", cue: c.cue, state: "published", speaker: c.speaker, text: c.text, voice: c.voice, seconds: c.seconds, envelope: c.envelope, seed: manifest.batch });
    }
    expect((await events()).filter((e) => e.data.batch === manifest.batch)).toHaveLength(1);
  });

  it("are added once to an install seeded before they existed, and not again", async () => {
    await wipe();
    expect(await fresh()).toEqual({});
    await seedVoiceovers(pool());
    await seedVoiceovers(pool());
    expect(await files()).toHaveLength(manifest.clips.length);
    expect(await events()).toEqual([{ data: expect.objectContaining({ batch: manifest.batch, stored: manifest.clips.length }) }]);
    // a clip removed afterwards does not come back
    const doc = await readVoiceovers();
    delete doc.clips["toss-ow"];
    await q("UPDATE settings SET value=$2 WHERE key=$1", [VOICEOVERS_KEY, JSON.stringify(doc)]);
    await seedVoiceovers(pool());
    expect((await readVoiceovers()).clips["toss-ow"]).toBeUndefined();
    expect(await files()).toHaveLength(manifest.clips.length);
  });

  it("never replace a clip an administrator published, when a batch is applied over it", async () => {
    await wipe();
    await seedVoiceovers(pool());
    expect((await post({ action: "generate", cue: "scale-fat" })).status).toBe(200);
    expect((await post({ action: "accept", cue: "scale-fat" })).status).toBe(200);
    const mine = (await readVoiceovers()).clips["scale-fat"]!;
    expect(mine.seed).toBeUndefined();
    // the same clips arrive as a batch this install has not marked
    await q("DELETE FROM events WHERE project_id=$1 AND kind='seed.voiceovers'", [SEED]);
    const before = (await files()).length;
    await seedVoiceovers(pool());
    const doc = await readVoiceovers();
    expect(doc.clips["scale-fat"]).toEqual(mine);
    // and the seeded clips that are already there are not stored twice
    expect(await files()).toHaveLength(before);
    expect((await events()).at(-1)!.data.stored).toBe(0);
  });
});

describe("GET /api/voiceovers/[cue], the public route", () => {
  beforeAll(async () => {
    await wipe();
    await seedVoiceovers(pool());
  });

  it("gives the page its manifest: every cue with a clip, its address, length and envelope, and nothing else", async () => {
    const m = await fresh();
    expect(Object.keys(m).sort()).toEqual(manifest.clips.map((c) => c.cue).sort());
    const c = manifest.clips.find((x) => x.cue === "scale-fat")!;
    expect(m["scale-fat"]).toEqual({ url: `/api/voiceovers/scale-fat?v=${c.sha256.slice(0, 16)}`, seconds: c.seconds, envelope: c.envelope });
  });

  it("serves the clip signed out, as audio, with its ETag, and for a year when the address carries its sha256", async () => {
    const c = manifest.clips.find((x) => x.cue === "scale-fat")!;
    const bytes = await readFile(join(process.cwd(), SEED_VOICEOVERS_DIR, c.file));
    const res = await serve(anonymous("GET", undefined, url("scale-fat", `?v=${c.sha256.slice(0, 16)}`)), ctx("scale-fat"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("etag")).toBe(`"${c.sha256}"`);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
    // without the sha256, or with an old one, it is kept only briefly
    for (const query of ["", "?v=0000000000000000"]) expect((await get("scale-fat", query)).headers.get("cache-control")).toBe("public, max-age=300, must-revalidate");
  });

  it("answers 304 to a browser that already has it", async () => {
    const c = manifest.clips.find((x) => x.cue === "intro")!;
    const res = await get("intro", "", { "if-none-match": `W/"${c.sha256}"` });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
    expect((await get("intro", "", { "if-none-match": '"something-else"' })).status).toBe(200);
  });

  it("answers byte ranges, as audio elements ask for them", async () => {
    const c = manifest.clips.find((x) => x.cue === "scale-fat")!;
    const bytes = await readFile(join(process.cwd(), SEED_VOICEOVERS_DIR, c.file));
    const part = await get("scale-fat", "", { range: "bytes=100-299" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 100-299/${c.size}`);
    expect(part.headers.get("content-length")).toBe("200");
    expect(Buffer.from(await part.arrayBuffer()).equals(bytes.subarray(100, 300))).toBe(true);
    const open = await get("scale-fat", "", { range: "bytes=0-" });
    expect(open.status).toBe(206);
    expect(open.headers.get("content-range")).toBe(`bytes 0-${c.size - 1}/${c.size}`);
    const tail = await get("scale-fat", "", { range: "bytes=-10" });
    expect(Buffer.from(await tail.arrayBuffer()).equals(bytes.subarray(c.size - 10))).toBe(true);
    const past = await get("scale-fat", "", { range: `bytes=${c.size}-` });
    expect(past.status).toBe(416);
    expect(past.headers.get("content-range")).toBe(`bytes */${c.size}`);
  });

  it("serves nothing but a published clip of a cue of the film", async () => {
    for (const cue of ["no-such", "scale", "SCALE-FAT", "1", "scale-fat.mp3", "..%2f..%2fetc", "scale-fat-extra-part"]) {
      const r = await read(await get(cue));
      expect({ cue, ...r }).toEqual({ cue, status: 404, body: { error: "That voice-over was not found." } });
    }
    // a file any signed-in account can upload, dressed as a published voice-over, is not served: the route follows
    // the voice-over document, and that still names the clip that was published
    const c = manifest.clips.find((x) => x.cue === "scale-fat")!;
    await q("INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,'scale-fat.mp3','audio/mpeg','voiceover',3,'f00d',$2,$3)", [SEED, Buffer.from("bad"), JSON.stringify({ cue: "scale-fat", state: "published", folder: "Voice-overs" })]);
    expect((await get("scale-fat")).headers.get("etag")).toBe(`"${c.sha256}"`);
    await q("DELETE FROM files WHERE sha256='f00d'");
    // a published file whose bytes are no longer the ones published is not served either
    const doc = await readVoiceovers();
    await q("UPDATE files SET sha256='changed' WHERE id=$1", [doc.clips["hold-dark"]!.fileId]);
    expect((await get("hold-dark")).status).toBe(404);
    await q("UPDATE files SET sha256=$2 WHERE id=$1", [doc.clips["hold-dark"]!.fileId, doc.clips["hold-dark"]!.sha256]);
    expect((await get("hold-dark")).status).toBe(200);
    // a cue with no published clip: the film shows its subtitle only
    delete doc.clips["toss-ow"];
    await q("UPDATE settings SET value=$2 WHERE key=$1", [VOICEOVERS_KEY, JSON.stringify(doc)]);
    expect((await get("toss-ow")).status).toBe(404);
    expect((await fresh())["toss-ow"]).toBeUndefined();
  });

  it("refuses a NUL character in the address", async () => {
    expect(await read(await get("scale-fat", "?v=%00"))).toEqual({ status: 400, body: { error: NUL_REFUSED } });
    expect(await read(await serve(new Request("http://test.local/api/voiceovers/scale%00fat"), ctx("scale\u0000fat")))).toEqual({ status: 400, body: { error: NUL_REFUSED } });
  });
});

describe("Admin, Voice-overs", () => {
  beforeAll(async () => {
    await wipe();
    await seedVoiceovers(pool());
  });
  type View = { rows: { cue: string; speaker: string; text: string; window: number | null; clip: { url: string; voice: string; seeded: boolean; seconds: number } | null; take: { url: string; voice: string; speed: number; say: string; seconds: number } | null; versions: number }[]; cast: Record<string, unknown>; voice: { configured: boolean; reason?: string; model?: string }; canWrite: boolean };
  const view = async () => (await read<View>(await list(json("GET", undefined, "http://test.local/api/admin/voiceovers")))).body;
  const row = async (cue: string) => (await view()).rows.find((r) => r.cue === cue)!;

  it("lists every cue with its words, speaker and published clip", async () => {
    const v = await view();
    expect(v.rows.map((r) => r.cue)).toEqual(VOICE_CUES.map((c) => c.key));
    expect(v.canWrite).toBe(true);
    expect(v.voice).toMatchObject({ configured: true, model: "kokoro" });
    const fat = v.rows.find((r) => r.cue === "scale-fat")!;
    expect(fat).toMatchObject({ speaker: "bag", text: "Are you... calling me FAT?", window: 2.8, take: null, versions: 0, clip: { seeded: true, voice: CAST.bag.voice } });
    expect(v.rows.find((r) => r.cue === "intro")!.window).toBeNull();
  });

  it("is the platform administrator's only: anyone else reads what is published and changes nothing", async () => {
    await post({ action: "generate", cue: "hold-dark" });
    hook.admin = false;
    for (const body of [
      { action: "generate", cue: "scale-fat" },
      { action: "accept", cue: "hold-dark" },
      { action: "discard", cue: "hold-dark" },
      { action: "cast", speaker: "bag", model: "kokoro", voice: "af_sky", speed: 1 },
    ]) {
      expect(await read(await post(body)), body.action).toEqual({ status: 403, body: { error: PLATFORM_ADMIN_NOTICE } });
    }
    expect((await takeGet(json("GET", undefined, "http://test.local/api/admin/voiceovers/take/hold-dark"), ctx("hold-dark"))).status).toBe(403);
    const v = await view();
    expect(v.canWrite).toBe(false);
    expect(v.voice).toEqual({ configured: true, provider: "kokoro" });
    expect(v.rows.every((r) => r.take === null)).toBe(true);
    expect(v.rows.find((r) => r.cue === "hold-dark")!.clip).not.toBeNull();
    // signed out: nothing at all
    expect((await list(anonymous("GET", undefined, "http://test.local/api/admin/voiceovers"))).status).toBe(401);
    expect((await act(anonymous("POST", { action: "accept", cue: "hold-dark" }, "http://test.local/api/admin/voiceovers"))).status).toBe(401);
    hook.admin = true;
    expect((await read<{ ok: boolean }>(await post({ action: "discard", cue: "hold-dark" }))).body.ok).toBe(true);
  });

  it("says Voice is not configured, and makes no take, when no voice service is set up", async () => {
    speech.configured = false;
    const r = await read<{ error: string }>(await post({ action: "generate", cue: "scale-fat" }));
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/^Voice is not configured\. Set it in Admin, Voice\./);
    expect((await view()).voice).toMatchObject({ configured: false });
    expect((await row("scale-fat")).take).toBeNull();
  });

  it("generates a take with the speaker's voice, measured and stored but not published", async () => {
    const published = (await get("scale-fat")).headers.get("etag");
    expect((await post({ action: "cast", speaker: "bag", model: "kokoro", voice: "af_nicole", speed: 0.9 })).status).toBe(200);
    expect((await view()).cast).toEqual({ bag: { model: "kokoro", voice: "af_nicole", speed: 0.9 } });
    const r = await read<{ ok: boolean; seconds: number; voice: string }>(await post({ action: "generate", cue: "scale-fat" }));
    expect(r).toEqual({ status: 200, body: { ok: true, seconds: 0.1, voice: "af_nicole" } });
    // the shaped text was sent, with the cast's choice
    expect(speech.asked.at(-1)).toEqual({ text: VOICE_CUES.find((c) => c.key === "scale-fat")!.say, choice: { model: "kokoro", voice: "af_nicole", speed: 0.9 } });
    const take = (await row("scale-fat")).take!;
    expect(take).toMatchObject({ voice: "af_nicole", speed: 0.9, seconds: 0.1 });
    const stored = (await files()).find((f) => f.meta.cue === "scale-fat" && f.meta.state === "take")!;
    expect(stored.name).toBe("scale-fat.wav");
    // the envelope was worked out on the server from the decoded audio: silent, full, 6 dB down, full, silent
    const e = [...decodeEnvelope(stored.meta.envelope)];
    expect([e[0], e[1], e[3], e[4]]).toEqual([0, 255, 255, 0]);
    expect(e[2]! / 255).toBeCloseTo(0.8, 1);
    // the administrator can hear it; the public still gets the published clip
    const heard = await takeGet(json("GET", undefined, "http://test.local/api/admin/voiceovers/take/scale-fat"), ctx("scale-fat"));
    expect(heard.status).toBe(200);
    expect(heard.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await heard.arrayBuffer()).equals(Buffer.from(speech.audio!))).toBe(true);
    expect((await get("scale-fat")).headers.get("etag")).toBe(published);
    expect((await fresh())["scale-fat"]!.url).toContain(published!.slice(1, 17));
  });

  it("a line's own voice, speed and shaped text replace the speaker's; another take replaces the first", async () => {
    await post({ action: "generate", cue: "scale-fat", voice: "bf_emma", speed: 1.2, say: "Are you... calling me, FAT?!" });
    expect(speech.asked.at(-1)).toEqual({ text: "Are you... calling me, FAT?!", choice: { model: "kokoro", voice: "bf_emma", speed: 1.2 } });
    expect((await row("scale-fat")).take).toMatchObject({ voice: "bf_emma", speed: 1.2, say: "Are you... calling me, FAT?!" });
    expect((await files()).filter((f) => f.meta.cue === "scale-fat" && f.meta.state === "take")).toHaveLength(1);
  });

  it("accepting a take publishes it, with its envelope, and keeps the clip it replaces as a version", async () => {
    const before = (await readVoiceovers()).clips["scale-fat"]!;
    expect(await read(await post({ action: "accept", cue: "scale-fat" }))).toEqual({ status: 200, body: { ok: true, seconds: 0.1 } });
    const r = await row("scale-fat");
    expect(r).toMatchObject({ take: null, versions: 1, clip: { voice: "bf_emma", seeded: false, seconds: 0.1 } });
    const res = await get("scale-fat");
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(speech.audio!))).toBe(true);
    const m = await fresh();
    expect(m["scale-fat"]).toMatchObject({ seconds: 0.1, url: r.clip!.url });
    expect([...decodeEnvelope(m["scale-fat"]!.envelope)]).toHaveLength(5);
    // the earlier clip is still in the files store, marked as a version
    const old = (await files()).find((f) => Number(f.id) === before.fileId)!;
    expect(old.meta.state).toBe("version");
    expect((await readVoiceovers()).versions["scale-fat"]![0]).toMatchObject({ fileId: before.fileId, sha256: before.sha256 });
    const line = await q<{ summary: string; detail: { before: { sha256: string }; after: { voice: string } } }>("SELECT summary, detail FROM audit_log WHERE action='voiceover.published' ORDER BY id DESC LIMIT 1");
    expect(line[0]!.detail).toMatchObject({ before: { sha256: before.sha256 }, after: { voice: "bf_emma" } });
    // nothing is left to accept
    expect((await post({ action: "accept", cue: "scale-fat" })).status).toBe(404);
  });

  it("discarding a take removes it and leaves the published clip", async () => {
    const published = (await get("hold-dark")).headers.get("etag");
    await post({ action: "generate", cue: "hold-dark" });
    const n = (await files()).length;
    expect((await read<{ ok: boolean }>(await post({ action: "discard", cue: "hold-dark" }))).body.ok).toBe(true);
    expect(await files()).toHaveLength(n - 1);
    expect((await row("hold-dark")).take).toBeNull();
    expect((await get("hold-dark")).headers.get("etag")).toBe(published);
    expect((await read<{ ok: boolean }>(await post({ action: "discard", cue: "hold-dark" }))).body.ok).toBe(false);
  });

  it("refuses a cue the film does not have, a speed out of range, and audio that cannot be measured", async () => {
    expect((await post({ action: "generate", cue: "scale-nothing" })).status).toBe(404);
    expect((await post({ action: "generate", cue: "../etc" })).status).toBe(400);
    expect((await post({ action: "generate", cue: "scale-fat", speed: 9 })).status).toBe(400);
    expect((await post({ action: "cast", speaker: "pilot", model: "kokoro", voice: "x", speed: 1 })).status).toBe(400);
    speech.audio = new TextEncoder().encode("<html>an error page</html>");
    const r = await read<{ error: string }>(await post({ action: "generate", cue: "toss-ow" }));
    expect(r).toEqual({ status: 502, body: { error: "The voice-over must be MP3 or WAV to be measured and stored. Ask the speech service for MP3." } });
    expect((await row("toss-ow")).take).toBeNull();
  });
});
