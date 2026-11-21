// @vitest-environment jsdom
// U26: with no saved theme the system's light or dark setting decides. U8: the shell's first focusable element
// is "Skip to content", pointing at <main id="main" tabIndex=-1>.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersDark, THEME_KEY } from "@/lib/theme";

const media = (dark: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: dark && q.includes("dark"), media: q, addEventListener() {}, removeEventListener() {} }));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("theme", () => {
  it("follows the system when nothing is saved", () => {
    media(true);
    expect(prefersDark()).toBe(true);
    media(false);
    expect(prefersDark()).toBe(false);
  });
  it("a saved choice wins", () => {
    media(true);
    localStorage.setItem(THEME_KEY, "light");
    expect(prefersDark()).toBe(false);
  });
});

describe("skip link", () => {
  it("is the first focusable element of the shell and targets the main region", () => {
    const s = readFileSync("src/components/Shell.tsx", "utf8");
    const skip = s.indexOf('href="#main"');
    expect(skip).toBeGreaterThan(0);
    expect(s.indexOf("<aside")).toBeGreaterThan(skip);
    expect(s).toContain("Skip to content");
    expect(s).toMatch(/<main id="main" tabIndex=\{-1\}/);
  });
});
