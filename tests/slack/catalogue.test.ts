// The catalogue's own rules: unique keys, known roles, defaults, and links that land on pages the menu has.
import { describe, expect, it } from "vitest";
import { ACTIONS, ACTION_KEYS, EVENTS, EVENT_KEYS, SLACK_ROLES, eventsFor } from "@/lib/slack";
import { findSection } from "@/lib/menu";
import { EXAMPLES } from "./examples";

describe("event keys", () => {
  it("are unique, and each equals the key inside its entry", () => {
    expect(new Set(EVENT_KEYS).size).toBe(EVENT_KEYS.length);
    for (const k of EVENT_KEYS) expect(EVENTS[k].key).toBe(k);
  });

  it("are dotted lower-case words, starting with the audience", () => {
    for (const k of EVENT_KEYS) expect(k, k).toMatch(/^(platform|workspace)(\.[a-z_]+)+$/);
  });

  it("belong to the section of the specification their audience says", () => {
    expect(eventsFor("platform").length).toBe(14);
    expect(eventsFor("workspace").length + eventsFor("person").length).toBe(19);
    expect(eventsFor("person").map((e) => e.key)).toEqual(["workspace.mention"]);
    for (const k of EVENT_KEYS) if (k.startsWith("platform.")) expect(EVENTS[k].audience).toBe("platform");
  });

  it("each has a title, a description, and only the optional digests are off by default", () => {
    for (const k of EVENT_KEYS) {
      expect(EVENTS[k].title.length).toBeGreaterThan(3);
      expect(EVENTS[k].description.length).toBeGreaterThan(10);
    }
    expect(EVENT_KEYS.filter((k) => !EVENTS[k].defaultOn)).toEqual(["platform.digest.daily", "workspace.summary.weekly"]);
  });
});

describe("action keys", () => {
  it("are unique", () => {
    expect(new Set(ACTION_KEYS).size).toBe(ACTION_KEYS.length);
  });

  it("each needs one of the app's roles: platform administrator, workspace owner, admin or member", () => {
    expect([...SLACK_ROLES]).toEqual(["platform_admin", "owner", "admin", "member"]);
    for (const k of ACTION_KEYS) expect(SLACK_ROLES as readonly string[], k).toContain(ACTIONS[k].role);
  });

  it("platform buttons need the platform administrator; workspace buttons need a workspace role", () => {
    for (const k of ACTION_KEYS) {
      if (k.startsWith("platform.")) expect(ACTIONS[k].role, k).toBe("platform_admin");
      else expect(ACTIONS[k].role, k).not.toBe("platform_admin");
    }
  });

  it("every action an event lists exists, belongs to its audience, and every action is used by some event", () => {
    const used = new Set<string>();
    for (const k of EVENT_KEYS) {
      expect(new Set(EVENTS[k].actions).size).toBe(EVENTS[k].actions.length);
      for (const a of EVENTS[k].actions) {
        expect(a in ACTIONS, `${k} lists ${a}`).toBe(true);
        expect(a.startsWith(k.startsWith("platform.") ? "platform." : "workspace."), `${k} lists ${a}`).toBe(true);
        used.add(a);
      }
    }
    expect([...used].sort()).toEqual([...ACTION_KEYS].sort());
  });

  it("labels fit a Slack button and are the specification's words", () => {
    for (const k of ACTION_KEYS) expect([...ACTIONS[k].label].length).toBeLessThanOrEqual(75);
    expect(ACTIONS["platform.access_request.approve"].label).toBe("Approve and invite");
    expect(ACTIONS["workspace.decision.yes"].label).toBe("Decide: Yes");
    expect(ACTIONS["platform.open_stripe"].label).toBe("Open in Stripe");
  });
});

describe("menu pages the messages link to", () => {
  it("exist in the menu", () => {
    for (const [stage, section] of [
      ["design", "requirements"], ["concept", "decisions"], ["concept", "questions"], ["research", "claims"], ["marketing", "positioning"],
      ["design", "bom"], ["production", "economics"], ["prototype", "printing"], ["sales", "listing"], ["marketing", "campaigns"], ["sales", "reviews"],
    ] as const) {
      expect(findSection(stage, section), `${stage}/${section}`).not.toBeNull();
    }
  });

  it("a mention must name a section of the menu", () => {
    const e = EXAMPLES["workspace.mention"][0].payload;
    expect(EVENTS["workspace.mention"].payload.safeParse(e).success).toBe(true);
    expect(EVENTS["workspace.mention"].payload.safeParse({ ...e, section: "nowhere" }).success).toBe(false);
  });
});
