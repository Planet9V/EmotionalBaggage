// @vitest-environment jsdom
// The brand: the link's accessible name is the written name, the animated mark is hidden from assistive
// technology, and no source file names the product by an earlier name.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { BrandLink, Wordmark } from "@/components/brand/ShipwrightMark";
import { BRAND } from "@/components/brand/name";

afterEach(cleanup);

describe("the Shipwright brand", () => {
  it("is a link named Shipwright whose mark is hidden, and passes axe", async () => {
    const { container } = render(<main><BrandLink href="/welcome" /></main>);
    const link = screen.getByRole("link", { name: "Shipwright" });
    expect(link.getAttribute("href")).toBe("/welcome");
    const svg = link.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect((await axe.run(container, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });

  it("plays the knock on load and again when the pointer or the focus arrives, with a fixed size (no layout shift)", () => {
    render(<BrandLink href="/" size={26} />);
    const link = screen.getByRole("link", { name: "Shipwright" });
    const first = link.querySelector("svg")!;
    expect(first.classList.contains("sw-play")).toBe(true);
    expect(first.getAttribute("width")).toBe("26");
    fireEvent.pointerEnter(link);
    const second = link.querySelector("svg")!;
    expect(second).not.toBe(first); // a new element: the CSS animation starts again
    fireEvent.focus(link);
    expect(link.querySelector("svg")).not.toBe(second);
  });

  it("is a still where it is not a link", () => {
    const { container } = render(<Wordmark />);
    expect(container.textContent).toBe(BRAND);
    expect(container.querySelector("svg")!.classList.contains("sw-play")).toBe(false);
  });

  it("moves only under no-preference: reduced motion gets the finished still", () => {
    const css = readFileSync("src/components/brand/shipwright.css", "utf8");
    const outside = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(outside).not.toMatch(/animation\s*:/);
    expect(css.slice(css.indexOf("@keyframes")).match(/(?<![-\w])(?!transform|opacity|stroke-dashoffset|animation-timing-function)[a-z-]+(?=\s*:)/g)).toBeNull();
  });

  it("no source file, test or guide names the product by an earlier name", () => {
    const old = /concept to realization|product workbench/i;
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|mjs|md|css|py)$/.test(e.name) && p !== path.join("tests", "ui", "brand.test.tsx") && old.test(readFileSync(p, "utf8"))) found.push(p);
      }
    };
    for (const dir of ["src", "tests", "scripts", "planner", path.join("docs", "guide")]) walk(dir);
    expect(found).toEqual([]);
  });
});
