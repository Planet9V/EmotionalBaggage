import { describe, expect, it } from "vitest";
import { CHANNELS, channelsWith, channelName, findChannel, namesWith } from "@/lib/channels/registry";
import { AD_CHANNELS, SOCIAL_CHANNELS } from "@/lib/content/channels";
import { LAYOUTS } from "@/lib/campaigns/csv";
import { channelOf } from "@/lib/channels/channelName";
import { INBOX_CHANNELS, REPLY_CHANNELS, inboxData, replyData } from "@/lib/channels/schemas";
import { PURCHASE_SOURCES } from "@/lib/channels/registry";

describe("channel registry", () => {
  it("has unique ids and names", () => {
    expect(new Set(CHANNELS.map((c) => c.id)).size).toBe(CHANNELS.length);
    expect(new Set(CHANNELS.map((c) => c.name.toLowerCase())).size).toBe(CHANNELS.length);
  });
  it("every ad spec names a channel that supports ads, and its platform is the registry name", () => {
    for (const s of AD_CHANNELS) {
      expect(channelsWith("ads").map((c) => c.id)).toContain(s.channel);
      expect(s.platform).toBe(channelName(s.channel));
    }
    // every channel that says it supports ads has at least one spec
    for (const c of channelsWith("ads")) expect(AD_CHANNELS.some((s) => s.channel === c.id)).toBe(true);
  });
  it("social specs are exactly the channels that support social, in registry order", () => {
    expect(SOCIAL_CHANNELS.map((c) => c.id)).toEqual(["x", "instagram", "facebook", "pinterest", "tiktok", "reddit", "linkedin"]);
    expect(SOCIAL_CHANNELS.map((c) => c.label)).toEqual(["X", "Instagram", "Facebook", "Pinterest", "TikTok", "Reddit", "LinkedIn"]);
    for (const c of SOCIAL_CHANNELS) expect(c.max).toBeGreaterThan(0);
  });
  it("import layouts name channels that support import, with a stored key that did not change", () => {
    for (const l of LAYOUTS) expect(channelsWith("import").map((c) => c.id)).toContain(l.channel);
    expect(LAYOUTS.map((l) => l.memoryKey)).toEqual(["amazon-ads", "meta", "google", "other"]);
  });
  it("inbox and reply names are the same words the forms stored before", () => {
    expect([...INBOX_CHANNELS]).toEqual(["X", "Instagram"]);
    expect([...REPLY_CHANNELS]).toEqual(["X", "Instagram", "Amazon", "Other"]);
    expect(inboxData.safeParse({ channel: "Instagram" }).success).toBe(true);
    expect(inboxData.safeParse({ channel: "Facebook" }).success).toBe(false);
    expect(replyData.safeParse({ channel: "Other" }).success).toBe(true);
    expect([...namesWith("inbox")]).toEqual([...INBOX_CHANNELS]);
  });
  it("reads aliases and only the two sendable channels send", () => {
    expect(findChannel(" Twitter ")?.id).toBe("x");
    expect(findChannel("ig")?.id).toBe("instagram");
    expect(findChannel("nope")).toBeNull();
    expect(channelOf("Twitter")).toBe("x");
    expect(channelOf("IG")).toBe("instagram");
    expect(channelOf("Amazon")).toBeNull();
    expect(channelsWith("send").map((c) => c.id)).toEqual(["x", "instagram"]);
  });
  it("purchase sources keep their order", () => {
    expect([...PURCHASE_SOURCES]).toEqual(["Amazon", "Micro Center", "Own printer", "Other"]);
  });
});
