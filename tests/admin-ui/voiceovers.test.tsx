// @vitest-environment jsdom
// Admin, Voice-overs in the browser: models and voices from the live list with what each model takes, the Kokoro
// label, the hearing aid (length and loudness of takes side by side; the choice is the owner's ear), starring and
// publishing a take, and "Generate takes for every line" showing its cost before anything is generated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { VoiceoversTab } from "@/components/admin/VoiceoversTab";
import { VOICE_CUES } from "@/components/welcome/scenes/voiceScript";
import { CUE_DIRECTIONS, SPEAKER_NOTE } from "@/components/welcome/scenes/voiceDirections";
import { adminServer, on, renderWithClient, shimBrowser } from "./harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const take = (id: string, o: Record<string, unknown> = {}) => ({ id, url: `/api/admin/voiceovers/take/scale-fat?id=${id}`, starred: false, seconds: 2.4, voice: "nova", model: "openai/gpt-4o-mini-tts-2025-12-15", provider: "openrouter", speed: 1, say: "Are you... calling me FAT?", at: "2026-11-22T10:00:00Z", via: "instructions", direction: "…", lufs: -18.2, peak: -1.9, ...o });
const rows = (takes: unknown[]) =>
  VOICE_CUES.map((c) => ({ cue: c.key, speaker: c.who, text: c.text, window: c.window, direction: CUE_DIRECTIONS[c.key]!.direction, inlineTags: CUE_DIRECTIONS[c.key]!.inlineTags, directionEdited: false, clip: null, takes: c.key === "scale-fat" ? takes : [], versions: 0 }));
const view = (provider: "kokoro" | "openrouter", takes: unknown[] = []) => ({ rows: rows(takes), cast: {}, notes: SPEAKER_NOTE, voice: { configured: true, provider, model: provider === "kokoro" ? "kokoro" : "openai/gpt-4o-mini-tts-2025-12-15", voice: "nova", speed: 1 }, canWrite: true });
const catalog = {
  provider: "openrouter",
  ok: true,
  models: [
    { id: "openai/gpt-4o-mini-tts-2025-12-15", name: null, voices: ["nova", "coral"], parameters: ["voice", "instructions"], pricePerChar: null, mode: "instructions", modeWhy: "Lists instructions.", note: "OpenAI has announced this model's shutdown on 6 January 2027.", description: null },
    { id: "fishaudio/s2.1-pro", name: "Fish Audio S2.1 Pro", voices: ["bright-woman"], parameters: ["voice"], pricePerChar: 0.000015, mode: "inline", modeWhy: "Reads bracket cues.", note: null, description: null },
  ],
};

describe("Admin, Voice-overs", () => {
  it("shows each take's length and loudness side by side, says the choice is the owner's ear, and stars and publishes a take", async () => {
    const { calls } = adminServer([
      on("GET", "/api/admin/voiceovers", () => ({ body: view("openrouter", [take("aaaa1111"), take("bbbb2222", { seconds: 3.1, lufs: -16.0 })]) })),
      on("GET", "/api/admin/voiceovers/models", () => ({ body: catalog })),
      on("POST", "/api/admin/voiceovers", () => ({ body: { ok: true, starred: true, seconds: 2.4 } })),
    ]);
    renderWithClient(<VoiceoversTab />);
    expect(await screen.findByText(/whether a take is funny is for your ear alone/)).toBeTruthy();
    expect(screen.getByText(/the app has no speech recogniser/)).toBeTruthy();
    const takes = within(screen.getByRole("list", { name: "Takes of scale-fat" }));
    expect(takes.getByText(/2\.4 s of 2\.8 s; -18\.2 LUFS, peak -1\.9 dBFS/)).toBeTruthy();
    expect(takes.getByText(/3\.1 s, longer than its subtitle \(2\.8 s\); -16\.0 LUFS/)).toBeTruthy();
    fireEvent.click(takes.getByRole("button", { name: "Star take 2" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && JSON.stringify(c.body) === JSON.stringify({ action: "star", cue: "scale-fat", take: "bbbb2222" }))).toBe(true));
    fireEvent.click(takes.getAllByRole("button", { name: "Publish" })[0]!);
    await waitFor(() => expect(calls.some((c) => JSON.stringify(c.body) === JSON.stringify({ action: "publish", cue: "scale-fat", take: "aaaa1111" }))).toBe(true));
  });

  it("offers the live models with what each takes, and sends the direction with three takes", async () => {
    const { calls } = adminServer([
      on("GET", "/api/admin/voiceovers", () => ({ body: view("openrouter") })),
      on("GET", "/api/admin/voiceovers/models", () => ({ body: catalog })),
      on("POST", "/api/admin/voiceovers", () => ({ body: { ok: true, via: "inline", takes: [] } })),
    ]);
    renderWithClient(<VoiceoversTab />);
    const card = within(await screen.findByTestId("cue-scale-fat"));
    await waitFor(() => expect(card.getByRole("option", { name: "Fish Audio S2.1 Pro (fishaudio/s2.1-pro)" })).toBeTruthy());
    fireEvent.change(card.getByLabelText("Model"), { target: { value: "fishaudio/s2.1-pro" } });
    expect(card.getByText("Bracket cues in the line", { selector: "span" })).toBeTruthy();
    expect(card.getByText(/\$15\.00 per million characters/)).toBeTruthy();
    fireEvent.change(card.getByLabelText("Voice"), { target: { value: "bright-woman" } });
    fireEvent.click(card.getByRole("button", { name: "Generate 3 takes" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ action: "generate", cue: "scale-fat", count: 3, model: "fishaudio/s2.1-pro", voice: "bright-woman", direction: CUE_DIRECTIONS["scale-fat"]!.direction, inlineTags: CUE_DIRECTIONS["scale-fat"]!.inlineTags, mode: "auto" }));
  });

  it("refuses bracket cues that change the subtitle's words", async () => {
    adminServer([on("GET", "/api/admin/voiceovers", () => ({ body: view("openrouter") })), on("GET", "/api/admin/voiceovers/models", () => ({ body: catalog }))]);
    renderWithClient(<VoiceoversTab />);
    const card = within(await screen.findByTestId("cue-scale-fat"));
    fireEvent.change(card.getByLabelText(/Bracket cues/), { target: { value: "[gasp] Are you calling me fat?" } });
    expect(card.getByText("Taking out the [cues] must leave the subtitle word for word.")).toBeTruthy();
    expect((card.getByRole("button", { name: "Generate 3 takes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("labels Kokoro as having no emotion control, and shows the cost of takes for every line before generating any", async () => {
    const { calls } = adminServer([
      on("GET", "/api/admin/voiceovers", () => ({ body: view("kokoro") })),
      on("GET", "/api/admin/voiceovers/models", () => ({ body: { provider: "kokoro", ok: true, models: [] } })),
      on("POST", "/api/admin/voiceovers", (c) => ((c.body as { action: string }).action === "estimate" ? { body: { ok: true, takes: 36, characters: 4100, cost: null, lines: VOICE_CUES.map((v) => ({ cue: v.key })) } } : { body: { ok: true, takes: [] } })),
    ]);
    renderWithClient(<VoiceoversTab />);
    expect(await screen.findByText(/no emotion control: for drafts/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Generate takes for every line…" }));
    expect(await screen.findByText(/Cost: unknown/)).toBeTruthy();
    expect(calls.filter((c) => c.method === "POST").map((c) => (c.body as { action: string }).action)).toEqual(["estimate"]);
    fireEvent.click(screen.getByRole("button", { name: "Generate 36 takes" }));
    await waitFor(() => expect(calls.filter((c) => (c.body as { action?: string } | undefined)?.action === "generate")).toHaveLength(VOICE_CUES.length));
  });
});
