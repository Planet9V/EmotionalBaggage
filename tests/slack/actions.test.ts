// Button values: encoded compactly, read back through the action's schema, and refused when altered.
import { describe, expect, it } from "vitest";
import { ACTIONS, ACTION_KEYS, SLACK_LIMITS, carriesValue, decodeActionValue, encodeActionValue, type ValueActionKey } from "@/lib/slack";

const SAMPLES: { [K in ValueActionKey]: Parameters<typeof encodeActionValue<K>>[1] } = {
  "platform.access_request.approve": { requestId: 7 },
  "platform.access_request.decline": { requestId: 7 },
  "platform.signup.confirm": { userId: "u_sam1" },
  "platform.signup.disable": { userId: "u_sam1" },
  "platform.user.disable": { userId: "Lee-9_x" },
  "workspace.decision.yes": { conceptId: "baggage-claims", itemId: 31 },
  "workspace.decision.no": { conceptId: "baggage-claims", itemId: 31 },
  "workspace.question.mark_decided": { conceptId: "baggage-claims", itemId: 14 },
  "workspace.review.draft_reply": { conceptId: "baggage-claims", itemId: 21 },
};

const VALUE_KEYS = ACTION_KEYS.filter(carriesValue);

describe("button values", () => {
  it("have a sample for every action that carries one, and the links carry none", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...VALUE_KEYS].sort());
    for (const k of ACTION_KEYS.filter((x) => !carriesValue(x))) expect(ACTIONS[k].value, k).toBeNull();
  });

  it.each(VALUE_KEYS)("%s round-trips", (key) => {
    const value = SAMPLES[key];
    const text = encodeActionValue(key, value as never);
    expect(text.length).toBeLessThan(80);
    expect(text.length).toBeLessThanOrEqual(SLACK_LIMITS.buttonValue);
    expect(decodeActionValue(key, text)).toEqual({ ok: true, value });
  });

  it("are compact: version, then the fields in order, joined with a colon", () => {
    expect(encodeActionValue("workspace.decision.yes", { conceptId: "baggage-claims", itemId: 31 })).toBe("1:baggage-claims:31");
    expect(encodeActionValue("platform.access_request.approve", { requestId: 7 })).toBe("1:7");
  });

  it("refuse a value that does not fit when encoding", () => {
    expect(() => encodeActionValue("workspace.decision.yes", { conceptId: "Bad Id", itemId: 1 })).toThrow();
    expect(() => encodeActionValue("workspace.decision.yes", { conceptId: "ok", itemId: 0 })).toThrow();
    expect(() => encodeActionValue("workspace.decision.yes", { conceptId: "ok", itemId: 1.5 })).toThrow();
    expect(() => encodeActionValue("platform.signup.confirm", { userId: "a:b" })).toThrow();
    expect(() => encodeActionValue("platform.access_request.approve", { requestId: -3 })).toThrow();
  });

  const TAMPERED: [string, unknown][] = [
    ["nothing", undefined],
    ["null", null],
    ["a number", 31],
    ["an empty string", ""],
    ["another version", "2:baggage-claims:31"],
    ["no version", "baggage-claims:31"],
    ["a missing field", "1:baggage-claims"],
    ["an extra field", "1:baggage-claims:31:extra"],
    ["a field that is not a number", "1:baggage-claims:abc"],
    ["a negative number", "1:baggage-claims:-4"],
    ["a number with a leading zero", "1:baggage-claims:031"],
    ["a decimal", "1:baggage-claims:3.5"],
    ["a number past the safe range", "1:baggage-claims:99999999999999999999"],
    ["an id with a space", "1:bad%20id:31"],
    ["an id with a capital", "1:Baggage:31"],
    ["an empty id", "1::31"],
    ["a broken percent code", "1:baggage-claims%:31"],
    ["an enormous value", `1:${"a".repeat(3_000)}:31`],
  ];

  it.each(TAMPERED)("refuses %s", (_name, text) => {
    for (const key of ["workspace.decision.yes", "workspace.decision.no", "workspace.question.mark_decided", "workspace.review.draft_reply"] as const) {
      const r = decodeActionValue(key, text);
      expect(r.ok, `${key} ${String(text)}`).toBe(false);
    }
  });

  it("refuses a value made for a different shape of action", () => {
    expect(decodeActionValue("platform.access_request.approve", "1:baggage-claims:31").ok).toBe(false);
    expect(decodeActionValue("workspace.decision.yes", "1:7").ok).toBe(false);
    expect(decodeActionValue("platform.signup.confirm", "1:7:8").ok).toBe(false);
  });

  it("a user id with characters that need encoding is refused, so a colon can never shift a field", () => {
    expect(decodeActionValue("platform.signup.confirm", "1:a%3Ab").ok).toBe(false);
    expect(decodeActionValue("platform.signup.confirm", "1:a%2Fb").ok).toBe(false);
  });

  it("tampering with any one character of any sample never gives a different valid value silently", () => {
    for (const key of VALUE_KEYS) {
      const good = encodeActionValue(key, SAMPLES[key] as never);
      const original = decodeActionValue(key, good);
      for (let i = 0; i < good.length; i++) {
        const bad = good.slice(0, i) + (good[i] === "z" ? "y" : "z") + good.slice(i + 1);
        const r = decodeActionValue(key, bad);
        // an altered value either fails, or is one the schema genuinely allows (another id); it never throws
        if (r.ok) expect(r).not.toEqual(original);
      }
    }
  });
});
