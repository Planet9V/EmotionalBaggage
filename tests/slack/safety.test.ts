// Hostile and oversized user text: whatever a person types into a name, a note, a review or a file name, the message
// cannot mention anyone, cannot form a link, stays inside Slack's limits and never cuts an entity in two.
import { describe, expect, it } from "vitest";
import { EVENTS, EVENT_KEYS, SLACK_LIMITS, buildMessage, type EventKey, type SlackMessage } from "@/lib/slack";
import { examplesOf } from "./examples";
import { limitProblems } from "./limits";

const BASE = "https://c2r.example.com";

const HOSTILE =
  "<!channel> <!here> <!everyone> <@U024BE7LH> <#C024BE7LR|general> <https://evil.example/x|Click here> <mailto:a@b.example> @channel @Here @everyone &amp; &lt; > https://evil.example/login\nsecond line\t*bold*";

type Path = (string | number)[];
type Json = unknown;

/** Paths of every string in a value, arrays included. */
function stringPaths(v: Json, at: Path = []): Path[] {
  if (typeof v === "string") return [at];
  if (Array.isArray(v)) return v.flatMap((x, i) => stringPaths(x, [...at, i]));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => stringPaths(x, [...at, k]));
  return [];
}

function withValue<T>(v: T, path: Path, value: string): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const copy: Record<string | number, unknown> = Array.isArray(v) ? ([...v] as unknown as Record<number, unknown>) : { ...(v as object) };
  copy[head as string] = withValue(copy[head as string], rest, value);
  return copy as T;
}

const allText = (m: SlackMessage): string[] =>
  [m.text, ...m.blocks.flatMap((b) => (b.type === "section" ? [b.text.text] : b.type === "context" ? b.elements.map((e) => e.text) : []))];

function assertInert(m: SlackMessage, where: string) {
  for (const t of allText(m)) {
    expect(t, where).not.toMatch(/[<>]/);
    expect(t, where).not.toMatch(/@(channel|here|everyone)/i);
    expect(t, where).not.toContain("://");
    expect(t, where).not.toMatch(/&(?!amp;|lt;|gt;)/);
    expect(t, where).not.toMatch(/[\n\r\t]/);
  }
  expect(limitProblems(m), where).toEqual([]);
}

type Case = { key: EventKey; name: string; path: Path; payload: never };

/** Every free-text field of every example: a field whose schema refuses the hostile value (an id, an enum) is not free text. */
function freeTextCases(value: string): Case[] {
  const out: Case[] = [];
  for (const key of EVENT_KEYS) {
    for (const e of examplesOf(key)) {
      for (const path of stringPaths(e.payload)) {
        const payload = withValue(e.payload, path, value);
        if (EVENTS[key].payload.safeParse(payload).success) out.push({ key, name: e.name, path, payload });
      }
    }
  }
  return out;
}

describe("hostile text in every free-text field", () => {
  const cases = freeTextCases(HOSTILE);

  it("covers a large set of fields (ids, enums, dates and currencies are not free text and are skipped)", () => {
    expect(cases.length).toBeGreaterThan(80);
    // every event has at least one field of free text, except the daily digest, which is numbers only
    const covered = new Set(cases.map((c) => c.key));
    for (const key of EVENT_KEYS.filter((k) => k !== "platform.digest.daily")) expect(covered.has(key), `${key} has no free-text field`).toBe(true);
  });

  it.each(cases.map((c) => [`${c.key} / ${c.name} / ${c.path.join(".")}`, c] as const))("%s", (_name, c) => {
    const msg = buildMessage(c.key, c.payload, { baseUrl: BASE });
    assertInert(msg, _name);
    // what was typed is still readable where the message shows the field: the characters are written as entities, not dropped
    const plain = buildMessage(c.key, withValue(c.payload, c.path, "plain"), { baseUrl: BASE });
    if (JSON.stringify(allText(plain)).includes("plain")) expect(allText(msg).join(" ")).toMatch(/&lt;!channel&gt;|&lt;@U024BE7LH&gt;/);
  });

  it("no button's address or value is built from user text", () => {
    for (const c of cases) {
      const msg = buildMessage(c.key, c.payload, { baseUrl: BASE });
      for (const b of msg.blocks) {
        if (b.type !== "actions") continue;
        for (const x of b.elements) {
          if (x.url) expect(x.url.startsWith(BASE) || x.url.startsWith("https://dashboard.stripe.com/")).toBe(true);
          expect(`${x.url ?? ""}${x.value ?? ""}`).not.toMatch(/evil|channel|here\b/i);
        }
      }
    }
  });

  it("the last-four field is inert even when it is the whole of what is shown", () => {
    const msg = buildMessage("platform.setting.changed", { by: "a", setting: "key", change: "set", endsWith: "<!>&" }, { baseUrl: BASE });
    assertInert(msg, "endsWith");
    expect(msg.text).toBe("a set key (ends &lt;!&gt;&amp;).");
  });

  it("an @-mention word is broken, an email address is not", () => {
    const msg = buildMessage("platform.signup.confirmed", { email: "dana@example.com", workspaceName: "@channel and @here" }, { baseUrl: BASE });
    expect(msg.text).toBe("dana@example.com confirmed their address and created workspace '@​channel and @​here'.");
    expect(msg.text).not.toMatch(/@(channel|here)/);
  });
});

describe("long text is cut, never overflowing", () => {
  const LONG = "word ".repeat(2_000);
  const cases = freeTextCases(LONG);

  it.each(cases.map((c) => [`${c.key} / ${c.name} / ${c.path.join(".")}`, c] as const))("%s", (_name, c) => {
    const msg = buildMessage(c.key, c.payload, { baseUrl: BASE });
    expect(limitProblems(msg)).toEqual([]);
    const section = msg.blocks[0];
    expect(section?.type === "section" && [...section.text.text].length).toBeLessThanOrEqual(SLACK_LIMITS.sectionText);
    expect(msg.text.length).toBeLessThanOrEqual(SLACK_LIMITS.sectionText);
    // where the message shows the field at all (a refused listing does not show its channel), it shows it cut
    const plain = buildMessage(c.key, withValue(c.payload, c.path, "plain"), { baseUrl: BASE });
    if (JSON.stringify(allText(plain)).includes("plain")) expect(allText(msg).join(" ")).toContain("…");
  });

  it("a field of ampersands, which grow five times when escaped, is cut before it is escaped, so no entity is split", () => {
    for (const c of freeTextCases("&".repeat(5_000))) {
      const msg = buildMessage(c.key, c.payload, { baseUrl: BASE });
      expect(limitProblems(msg), `${c.key} ${c.path.join(".")}`).toEqual([]);
      for (const t of allText(msg)) expect(t).not.toMatch(/&(?!amp;|lt;|gt;)/);
    }
  });

  it("every free-text field at once, in every event, still gives one valid message that ends cleanly", () => {
    for (const key of EVENT_KEYS) {
      for (const e of examplesOf(key)) {
        let payload = e.payload;
        for (const path of stringPaths(e.payload)) {
          const next = withValue(payload, path, "&<>".repeat(2_000));
          if (EVENTS[key].payload.safeParse(next).success) payload = next;
        }
        const msg = buildMessage(key, payload, { baseUrl: BASE });
        assertInert(msg, key);
        expect(msg.text).not.toMatch(/&[a-z]{0,3}$/);
      }
    }
  });

  it("a note is cut to 500 characters and a name to 200", () => {
    const note = buildMessage("platform.access_request.received", { requestId: 1, name: "n".repeat(1_000), email: "d@example.com", level: "", message: "m".repeat(2_000) }, { baseUrl: BASE });
    const parts = note.text.match(/^New access request: (n+…?), d@example.com\. '(m+…?)'$/);
    expect(parts).not.toBeNull();
    expect([...(parts?.[1] ?? "")].length).toBe(200);
    expect([...(parts?.[2] ?? "")].length).toBe(500);
  });

  it("a list of a hundred long dependents stays inside 3,000 characters", () => {
    const msg = buildMessage(
      "workspace.part.changed",
      { conceptId: "c", conceptName: "C", itemId: 1, part: "Speaker", from: "28 mm", to: "23 mm", dependents: Array.from({ length: 100 }, (_, i) => `dependent number ${i} ${"x".repeat(100)}`) },
      { baseUrl: BASE },
    );
    expect(limitProblems(msg)).toEqual([]);
    expect(msg.text).toContain("Depends on it: dependent number 0");
  });

  it("a button label is held to 75 characters", async () => {
    const { label } = await import("@/lib/slack/text");
    expect([...label("x".repeat(300))].length).toBe(75);
    expect(label("Open")).toBe("Open");
  });
});

describe("what a message never holds", () => {
  it("no event's facts have a field for a secret, a password, a token or a file's contents", () => {
    for (const key of EVENT_KEYS) {
      const shape = Object.keys((EVENTS[key].payload as unknown as { shape?: Record<string, unknown> }).shape ?? {});
      for (const f of shape) expect(f, `${key}.${f}`).not.toMatch(/secret|password|token|credential|contents?|body|link|url/i);
    }
  });
});
