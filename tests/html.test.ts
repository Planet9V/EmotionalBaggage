// One HTML escape, and every place that writes HTML or SVG with it: a value that tries to leave an
// attribute or a tag stays text.
import { describe, expect, it } from "vitest";
import { esc } from "@/lib/html";
import { launchHtml } from "@/lib/content/exports";
import { renderPage, type LandingSection, type RenderEnv } from "@/lib/content/landing";
import { buildSheet, type Palette } from "@/components/layout/export";
import { schematicSvg, type Graph } from "@/components/schematic/model";
import type { Item } from "@/lib/types";

const HOSTILE = `x" onload="alert(1)" y='z' <script>alert(1)</script> & more`;
/** No raw quote, angle bracket or lone ampersand survives. */
const harmless = (out: string) => {
  expect(out).not.toContain("<script>");
  expect(out).not.toContain(`onload="alert`);
  expect(out).not.toContain(`y='z'`);
};

describe("esc", () => {
  it("escapes & < > \" and ' in one pass, once", () => {
    expect(esc(`<a href="x" t='y'>&amp;</a>`)).toBe("&lt;a href=&quot;x&quot; t=&#39;y&#39;&gt;&amp;amp;&lt;/a&gt;");
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
    expect(esc(12)).toBe("12");
  });
});

describe("what writes HTML or SVG", () => {
  it("the landing page keeps a hostile image description inside its attribute", () => {
    const sections: LandingSection[] = [{ id: 1, kind: "hero", content: { headline: HOSTILE, subhead: HOSTILE, ctaLabel: "Go", ctaHref: "https://example.com", imageFileId: 5, imageAlt: HOSTILE }, status: "approved", order: 0 }];
    const env: RenderEnv = { name: HOSTILE, primary: "#0b5fff", competitors: [], priceText: () => null, proofLabel: () => null, image: () => ({ src: "images/1.png", file: "images/1.png" }) } as unknown as RenderEnv;
    const { html } = renderPage(sections, env);
    harmless(html);
    expect(html).toContain(`alt="x&quot; onload=&quot;alert(1)&quot; y=&#39;z&#39;`);
  });

  it("the launch email escapes the subject, the preview and the body", () => {
    const r = { id: 1, section: "x", title: "T", body: HOSTILE, status: "approved", sort: 0, data: { kind: "email", subjects: [HOSTILE], previewText: HOSTILE } } as unknown as Item;
    const html = launchHtml(r);
    harmless(html);
    expect(html).toContain("&#39;");
  });

  it("the layout sheet keeps a hostile concept name out of its aria-label and text", () => {
    const palette: Palette = { canvas: "#fff", surface: "#fff", subtle: "#eee", primary: "#111", secondary: "#333", muted: "#777", hairline: "#ddd", danger: "#b00", link: "#930", accent: "#e05" };
    const part = { id: 1, ref: HOSTILE, label: HOSTILE, geometry: { shape: "box", size: [40, 20, 10], pos: [0, 0, 0] } };
    const sheet = buildSheet({ conceptName: HOSTILE, parts: [part as never], shells: [], wall: 2, overlapping: new Set(), palette, date: HOSTILE });
    expect(sheet).not.toBeNull();
    harmless(sheet!.svg);
    expect(sheet!.svg).toContain(`aria-label="x&quot; onload=&quot;alert(1)&quot;`);
  });

  it("the schematic file escapes a hostile reference, title and net", () => {
    const node = { kind: "part" as const, id: "a", ref: HOSTILE, title: HOSTILE, ghost: false, pins: [], pos: { x: 0, y: 0 }, saved: true, part: null };
    const g: Graph = { nodes: [node], segments: [], byId: new Map([["a", node]]) };
    const svg = schematicSvg(g, { concept: HOSTILE, generatedAt: new Date(2026, 0, 2, 3, 4) });
    harmless(svg);
    expect(svg).toContain("&lt;script&gt;");
  });
});
