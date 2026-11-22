// Step 1 of docs/design/slack.md: every row of sections 2 and 3 produces the specification's example message, in
// valid Block Kit, with the buttons the row lists.
import { describe, expect, it } from "vitest";
import { ACTIONS, EVENTS, EVENT_KEYS, buildMessage, type EventKey } from "@/lib/slack";
import { EXAMPLES, examplesOf } from "./examples";
import { limitProblems } from "./limits";

const BASE = "https://c2r.example.com";

describe("the catalogue and the examples agree", () => {
  it("has an example for every event, and no example for an event that does not exist", () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual([...EVENT_KEYS].sort());
    for (const k of EVENT_KEYS) expect(EXAMPLES[k].length, k).toBeGreaterThan(0);
  });

  it("covers 14 platform rows and 19 workspace rows (sections 2 and 3)", () => {
    expect(EVENT_KEYS.filter((k) => k.startsWith("platform.")).length).toBe(14);
    expect(EVENT_KEYS.filter((k) => k.startsWith("workspace.")).length).toBe(19);
  });
});

describe.each(EVENT_KEYS)("%s", (key: EventKey) => {
  const examples = examplesOf(key);

  it.each(examples.map((e) => [e.name, e] as const))("says what the specification says: %s", (_name, e) => {
    // the facts are valid for the event's schema
    expect(EVENTS[key].payload.safeParse(e.payload).success).toBe(true);
    const msg = buildMessage(key, e.payload, { baseUrl: BASE });
    expect(msg.text).toBe(e.text);
    const first = msg.blocks[0];
    expect(first?.type).toBe("section");
    if (first?.type === "section") expect(first.text.text).toBe(e.text);
    expect(limitProblems(msg)).toEqual([]);
  });

  it.each(examples.map((e) => [e.name, e] as const))("offers the listed buttons, in order: %s", (_name, e) => {
    const msg = buildMessage(key, e.payload, { baseUrl: BASE });
    const bar = msg.blocks.find((b) => b.type === "actions");
    const ids = bar?.type === "actions" ? bar.elements.map((b) => b.action_id) : [];
    expect(ids).toEqual(e.buttons);
    expect(ids).toEqual([...EVENTS[key].actions]);
    for (const id of ids) expect(id in ACTIONS).toBe(true);
  });
});

describe("links", () => {
  const link = (key: EventKey, i = 0) => {
    const e = examplesOf(key)[i];
    const bar = buildMessage(key, e.payload, { baseUrl: BASE }).blocks.find((b) => b.type === "actions");
    return bar?.type === "actions" ? bar.elements.filter((b) => b.url).map((b) => b.url) : [];
  };

  it("point at the app's own pages, with the concept selected by ?concept=", () => {
    expect(link("workspace.gate.passed")).toEqual([`${BASE}/status?concept=baggage-claims`]);
    expect(link("workspace.gate.overridden")).toEqual([`${BASE}/process?concept=baggage-claims`]);
    expect(link("workspace.decision.waiting")).toEqual([`${BASE}/s/concept/decisions?item=31&concept=baggage-claims`]);
    expect(link("workspace.claim.checked")).toEqual([`${BASE}/s/research/claims?item=5&concept=baggage-claims`]);
    expect(link("workspace.part.changed")).toEqual([`${BASE}/s/design/bom?item=3&concept=baggage-claims`]);
    expect(link("workspace.cost.crossed")).toEqual([`${BASE}/s/production/economics?concept=baggage-claims`]);
    expect(link("workspace.print.job")).toEqual([`${BASE}/s/prototype/printing?item=9&concept=baggage-claims`]);
    expect(link("workspace.file.added")).toEqual([`${BASE}/files?concept=baggage-claims`]);
    expect(link("workspace.drafts.ready")).toEqual([`${BASE}/drafts?concept=baggage-claims`]);
    expect(link("workspace.mention")).toEqual([`${BASE}/s/concept/decisions?item=33&concept=baggage-claims`]);
    expect(link("platform.access_request.received")).toEqual([`${BASE}/admin?tab=access`]);
    expect(link("platform.payment.failed")).toEqual(["https://dashboard.stripe.com/customers/cus_Abc123", `${BASE}/admin`]);
  });

  it("accept a base address with a trailing slash or a path, and refuse one that is not a web address", () => {
    const e = EXAMPLES["workspace.gate.passed"][0];
    const bar = (base: string) => buildMessage("workspace.gate.passed", e.payload, { baseUrl: base }).blocks.find((b) => b.type === "actions");
    expect(JSON.stringify(bar("https://c2r.example.com/"))).toContain('"url":"https://c2r.example.com/status?concept=baggage-claims"');
    expect(JSON.stringify(bar("https://example.com/c2r/"))).toContain('"url":"https://example.com/c2r/status?concept=baggage-claims"');
    expect(() => bar("not a url")).toThrow(/web address/);
    expect(() => bar("javascript:alert(1)")).toThrow(/http/);
  });

  it("never carry a sign-in link or a secret: only the app's pages and Stripe's dashboard", () => {
    for (const key of EVENT_KEYS) {
      for (const e of examplesOf(key)) {
        const msg = buildMessage(key, e.payload, { baseUrl: BASE });
        const urls = msg.blocks.flatMap((b) => (b.type === "actions" ? b.elements.map((x) => x.url ?? "") : []));
        for (const u of urls.filter(Boolean)) expect(u.startsWith(BASE) || u.startsWith("https://dashboard.stripe.com/"), u).toBe(true);
        expect(JSON.stringify(msg)).not.toMatch(/token=|password|secret=|sign-?in\?/i);
      }
    }
  });
});

describe("rows that name a secret", () => {
  it("the setting-changed message shows only the last four characters, whatever it is given", () => {
    const msg = buildMessage("platform.setting.changed", { by: "admin@oxot.nl", setting: "the Stripe secret key", change: "replaced", endsWith: "4x2Q" }, { baseUrl: BASE });
    expect(msg.text).toBe("admin@oxot.nl replaced the Stripe secret key (ends 4x2Q).");
    // a caller that passed more than four characters (the schema refuses that) still shows four
    const whole = ["sk", "live", "51HabcdefghijklmnopQRSTUVWX4x2Q"].join("_"); // made up; assembled here so no key-shaped literal is in the repository
    const guarded = buildMessage("platform.setting.changed", { by: "admin@oxot.nl", setting: "the Stripe secret key", change: "replaced", endsWith: whole }, { baseUrl: BASE });
    expect(guarded.text).toBe("admin@oxot.nl replaced the Stripe secret key (ends 4x2Q).");
    expect(JSON.stringify(guarded)).not.toContain("sk_live");
    expect(EVENTS["platform.setting.changed"].payload.safeParse({ by: "a", setting: "k", change: "set", endsWith: whole }).success).toBe(false);
  });

  it("the file message shows the file's name and nothing of its contents", () => {
    const shape = Object.keys(EVENTS["workspace.file.added"].payload.shape);
    expect(shape.sort()).toEqual(["by", "conceptId", "conceptName", "file", "replaces"].sort());
  });
});
