import { describe, expect, it } from "vitest";
import { buildUtmUrl, checkDestination, CODE_ALPHABET, CODE_RE, hostAllowed, makeCode, parseHosts, slugify } from "@/lib/campaigns/links";
import { RateLimiter } from "@/lib/campaigns/rateLimit";

describe("the UTM convention", () => {
  it("writes lower case ASCII with hyphens", () => {
    expect(slugify("Meta Feed #2!")).toBe("meta-feed-2");
    expect(slugify("Café Été")).toBe("cafe-ete");
    expect(slugify("  --x--  ")).toBe("x");
    expect(slugify("!!!")).toBe("");
    expect(slugify("a".repeat(100)).length).toBe(60);
  });

  it("sets the parameters and says what it changed", () => {
    const r = buildUtmUrl("https://shop.example/product?ref=a", { source: "Meta", medium: "paid-social", campaign: "Baggage Claims-Launch", content: "Video 1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.link.url);
    expect(u.searchParams.get("ref")).toBe("a");
    expect(u.searchParams.get("utm_source")).toBe("meta");
    expect(u.searchParams.get("utm_campaign")).toBe("baggage-claims-launch");
    expect(u.searchParams.get("utm_content")).toBe("video-1");
    expect(u.searchParams.has("utm_term")).toBe(false);
    expect(r.link.notes.join(" ")).toContain('utm_source was written as "meta"');
  });

  it("replaces UTM parameters already on the address, and says so", () => {
    const r = buildUtmUrl("https://shop.example/?utm_source=old", { source: "x", medium: "social", campaign: "c" });
    expect(r.ok && new URL(r.link.url).searchParams.getAll("utm_source")).toEqual(["x"]);
    expect(r.ok && r.link.notes.join(" ")).toContain("already had utm_source");
  });

  it("needs a source, a medium and a campaign", () => {
    expect(buildUtmUrl("https://a.example", { source: "", medium: "cpc", campaign: "c" })).toEqual({ ok: false, reason: "utm_source is required." });
    expect(buildUtmUrl("https://a.example", { source: "x", medium: "cpc", campaign: "###" })).toMatchObject({ ok: false });
  });
});

describe("destinations", () => {
  it.each([
    ["https://shop.example/path?x=1", true],
    ["http://shop.example", false],
    ["javascript:alert(1)", false],
    ["data:text/html,hi", false],
    ["ftp://a.example", false],
    ["//evil.example", false],
    ["https://user:pw@a.example", false],
    ["https://a.example/has space", false],
    ["", false],
    ["not a url", false],
  ])("%s", (u, ok) => expect(checkDestination(u).ok).toBe(ok));
  it("accepts http only for localhost in development", () => {
    expect(checkDestination("http://localhost:3000/p", { dev: true }).ok).toBe(true);
    expect(checkDestination("http://localhost:3000/p", { dev: false }).ok).toBe(false);
    expect(checkDestination("http://shop.example/", { dev: true }).ok).toBe(false);
  });
  it("matches hosts on the allow-list and their sub-domains only", () => {
    expect(parseHosts("Shop.example, https://www.amazon.com/dp/x\nbad_host!")).toEqual({ hosts: ["shop.example", "www.amazon.com"], bad: ["bad_host!"] });
    expect(hostAllowed("www.shop.example", ["shop.example"])).toBe(true);
    expect(hostAllowed("shop.example.evil.test", ["shop.example"])).toBe(false);
    expect(hostAllowed("evilshop.example", ["shop.example"])).toBe(false);
  });
  it("refuses an address over 2,000 characters", () => {
    expect(checkDestination(`https://a.example/${"x".repeat(2000)}`).ok).toBe(false);
  });
});

describe("codes", () => {
  it("are 8 characters from an alphabet without look-alikes, and differ", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = makeCode();
      expect(c).toMatch(CODE_RE);
      expect(c.length).toBe(8);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
      seen.add(c);
    }
    expect(seen.size).toBe(500);
    for (const bad of "01oli") expect(CODE_ALPHABET).not.toContain(bad);
  });
});

describe("the rate limiter", () => {
  it("allows up to the limit per code in a window, then refuses with a wait, then allows again", () => {
    let t = 0;
    const r = new RateLimiter({ perCode: 3, total: 100, unknown: 2, windowMs: 60_000 }, () => t);
    expect([1, 2, 3].map(() => r.allow("abc").ok)).toEqual([true, true, true]);
    const refused = r.allow("abc");
    expect(refused).toEqual({ ok: false, retryAfter: 60 });
    expect(r.allow("other").ok).toBe(true);
    t = 30_000;
    expect(r.allow("abc").retryAfter).toBe(30);
    t = 60_000;
    expect(r.allow("abc").ok).toBe(true);
  });
  it("limits all codes together", () => {
    const r = new RateLimiter({ perCode: 10, total: 3, unknown: 2, windowMs: 1000 }, () => 0);
    expect([r.allow("a").ok, r.allow("b").ok, r.allow("c").ok, r.allow("d").ok]).toEqual([true, true, true, false]);
  });
  it("limits requests for codes that do not exist", () => {
    const r = new RateLimiter({ perCode: 10, total: 100, unknown: 2, windowMs: 1000 }, () => 0);
    expect([r.allowUnknown().ok, r.allowUnknown().ok, r.allowUnknown().ok]).toEqual([true, true, false]);
  });
});
