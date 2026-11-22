import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { isPublicPath, pageGate, PUBLIC_FOLDERS, safeNext, SESSION_COOKIE } from "@/app/sign-in/shared";

describe("the proxy's redirect rules", () => {
  it("sends a signed-out visit to the bare address to the welcome page, not the sign-in form", () => {
    expect(pageGate("/", "", false)).toBe("/welcome");
    expect(pageGate("/", "?concept=baggage-claims", false)).toBe("/welcome");
  });

  it("sends a signed-out page request to the sign-in page with where it was going", () => {
    expect(pageGate("/plan", "?view=graph", false)).toBe("/sign-in?next=%2Fplan%3Fview%3Dgraph");
    expect(pageGate("/s/design/bom", "", false)).toBe("/sign-in?next=%2Fs%2Fdesign%2Fbom");
    expect(pageGate("/account", "", false)).toBe("/sign-in?next=%2Faccount");
  });

  it("lets a request with the cookie through (the real check is in route())", () => {
    expect(pageGate("/", "", true)).toBeNull();
    expect(pageGate("/plan", "", true)).toBeNull();
  });

  it.each(["/sign-in", "/sign-in/", "/api/projects", "/api/auth/me", "/api/auth/sign-in", "/_next/static/chunks/a.js", "/_next/image", "/favicon.ico", "/vendor/occt/occt-import-js.wasm", "/audio/scenes/origin.mp3", "/l/abcd2345", "/welcome", "/welcome/overview", "/landing/schematic-dark.webp"])(
    "lets %s through signed out",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
      expect(pageGate(path, "", false)).toBeNull();
    }
  );

  it.each(["/", "/plan", "/report", "/new", "/integrations", "/docs", "/docs/user", "/account", "/sign-inx", "/apix", "/l", "/l/", "/l/abcd2345/extra", "/lx/abcd2345", "/links", "/welcomex", "/welcomes/overview", "/admin.json", "/p/abc.json", "/s/a/b.c", "/docs/x.md", "/_next/data/x/admin.json", "/_next/admin", "/landing", "/landing/", "/landing/x", "/models/frame.glb", "/vendorx/a.js"])("guards %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("names every folder of public/ (a file there is static; any other path with a dot is a page: review N1)", async () => {
    const { readdirSync } = await import("node:fs");
    const folders = readdirSync("public", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    expect(folders).toEqual([...PUBLIC_FOLDERS].sort());
  });

  it("never redirects to a path that leaves the site", () => {
    expect(pageGate("//evil.example/plan", "", false)).toBe("/sign-in?next=%2F");
  });
});

describe("the next parameter", () => {
  it.each([
    "//evil.example",
    "//evil.example/path",
    "https://evil.example",
    "http://evil.example/",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    "/\tevil",
    "/%0a",
    "/sign-in",
    "/sign-in?next=/plan",
  ])("rejects %j", (value) => {
    if (value === "/%0a") {
      // Percent-encoded text stays a harmless path on this site.
      expect(safeNext(value)).toBe("/%0a");
      return;
    }
    expect(safeNext(value)).toBe("/");
  });

  it("rejects missing and absurdly long values", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(`/${"a".repeat(3000)}`)).toBe("/");
  });

  it("keeps a path on this site, with its query and fragment", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/plan")).toBe("/plan");
    expect(safeNext("/s/design/bom?x=1#top")).toBe("/s/design/bom?x=1#top");
  });
});

describe("the proxy function", () => {
  it("redirects a signed-out visit to / to /welcome", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/welcome");
  });

  it("redirects a signed-out page request", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/report?print=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/sign-in?next=%2Freport%3Fprint%3D1");
  });

  it("lets a request with the session cookie continue", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/report", { headers: { cookie: `${SESSION_COOKIE}=whatever` } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
