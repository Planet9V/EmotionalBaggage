// The landing page: structured sections stored as rows, drawn by one renderer that makes plain HTML with
// inline CSS. The preview at /p/<concept id> shows that same HTML in a sandboxed frame, and the export is
// that same HTML with its images as files, so what you preview is what you host. No script is written
// into the page. Colours and type come from the brand kit; every colour pair used for text is raised to at
// least 4.5 to 1 against the background it sits on.
import { z } from "zod";
import { contrastRatio, parseHex } from "@/lib/market/contrast";
import { onColour } from "@/lib/market/brandKit";
import type { LandingKind } from "./schemas";
import { esc } from "@/lib/html";

const s = (n = 600) => z.string().max(n);
const href = z.string().max(500).optional();

export const LANDING_CONTENT: Record<LandingKind, z.ZodType<Record<string, unknown>>> = {
  hero: z.looseObject({ headline: s(160).min(1), subhead: s(400).default(""), ctaLabel: s(60).default("Get it"), ctaHref: href, imageFileId: z.number().int().nullable().optional(), imageAlt: s(300).optional() }),
  problem: z.looseObject({ heading: s(160).min(1), points: z.array(s(400)).min(1).max(5) }),
  how: z.looseObject({ heading: s(160).min(1), steps: z.array(z.object({ title: s(120), text: s(400) })).min(2).max(5) }),
  proof: z.looseObject({ heading: s(160).min(1), items: z.array(z.object({ claim: s(300), evidence: s(400).default(""), proofItemId: z.number().int() })).min(1).max(6) }),
  comparison: z.looseObject({ heading: s(160).min(1), intro: s(400).optional(), ourLine: s(300).optional(), competitorIds: z.array(z.number().int()).max(8).default([]) }),
  faq: z.looseObject({ heading: s(160).min(1), items: z.array(z.object({ q: s(300), a: s(1200) })).min(1).max(10) }),
  price: z.looseObject({ heading: s(160).min(1), note: s(400).optional(), ctaLabel: s(60).default("Order"), ctaHref: href, priceItemId: z.number().int().nullable().optional() }),
  footer: z.looseObject({ text: s(400).min(1), links: z.array(z.object({ label: s(60), href: s(500) })).max(6).optional() }),
};

export const KIND_LABEL: Record<LandingKind, string> = { hero: "Hero", problem: "The problem", how: "How it works", proof: "Proof", comparison: "Comparison", faq: "Questions", price: "Price and call to action", footer: "Footer" };

export type LandingSection = { id: number; kind: LandingKind; content: Record<string, unknown>; status: string; order: number };

export type Competitor = { id: number; title: string; priceText?: string; claim?: string; sourceUrl?: string; basis?: string };

/** A competitor row may be shown only when it has a source: researched or typed with a web address. */
export const isSourced = (c: Competitor) => c.basis !== "unsourced" && typeof c.sourceUrl === "string" && /^https?:\/\//i.test(c.sourceUrl);

export type RenderEnv = {
  name: string;
  /** brand kit colours (hex) or null for the default palette */
  primary: string | null;
  headingFont?: string;
  bodyFont?: string;
  competitors: Competitor[];
  /** the price text of the approved price row the price section names */
  priceText: (itemId: number | null | undefined) => string | null;
  /** "Verified claim: Battery lasts a week" for a proof row, or null when the row is gone or no longer proves anything */
  proofLabel: (itemId: number) => string | null;
  /** where an image file is read from: the app's file route for a preview, a path in the zip for an export */
  image: (fileId: number) => { src: string; file: string } | null;
  scheme: "light" | "dark" | "auto";
  boilerplate?: string;
  /** the brand kit as CSS custom properties (src/lib/market/brand.ts), written into the page for whoever edits it */
  brandVars?: string;
};

export type Rendered = { html: string; images: { fileId: number; file: string }[]; problems: string[] };

const safeHref = (h: unknown) => {
  const v = String(h ?? "").trim();
  return /^(https?:\/\/[^\s"'<>]+|#[\w-]*|mailto:[^\s"'<>]+)$/i.test(v) ? v : "#";
};

// ---- colour ----------------------------------------------------------------------------------

const hex = (rgb: [number, number, number]) => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

/** Moves a colour towards black (on a light ground) or white (on a dark one) until it reads at 4.5 to 1. */
function readable(colour: string, ground: string, min = 4.5): string {
  const rgb = parseHex(colour);
  if (!rgb) return colour;
  const target: [number, number, number] = (contrastRatio("#000000", ground) ?? 0) > (contrastRatio("#FFFFFF", ground) ?? 0) ? [0, 0, 0] : [255, 255, 255];
  let c = colour;
  for (let t = 0; t <= 1.0001; t += 0.04) {
    c = hex([rgb[0] + (target[0] - rgb[0]) * t, rgb[1] + (target[1] - rgb[1]) * t, rgb[2] + (target[2] - rgb[2]) * t]);
    if ((contrastRatio(c, ground) ?? 0) >= min) return c;
  }
  return c;
}

export type Palette = { primary: string; onPrimary: string; ink: string; paper: string; subtle: string; muted: string; rule: string; accentLight: string; accentDark: string; dInk: string; dPaper: string; dSubtle: string; dMuted: string; dRule: string; dPrimaryOn: string };

function palette(primary: string | null): Palette {
  const p = primary && parseHex(primary) ? primary.toUpperCase() : "#1F5FBF";
  return {
    primary: p,
    onPrimary: onColour(p),
    ink: "#15181D",
    paper: "#FFFFFF",
    subtle: "#F4F2EE",
    muted: "#4B5260",
    rule: "#D9D6CF",
    accentLight: readable(p, "#FFFFFF"),
    accentDark: readable(p, "#12151A"),
    dInk: "#F2F0EB",
    dPaper: "#12151A",
    dSubtle: "#1B1F26",
    dMuted: "#B4B9C4",
    dRule: "#363C47",
    dPrimaryOn: onColour(p),
  };
}

/** Contrast pairs the page uses for text, with their ratios, so a test and the editor can show them. */
export function contrastReport(primary: string | null) {
  const p = palette(primary);
  const pairs: [string, string, string][] = [
    ["Body text on page", p.ink, p.paper],
    ["Muted text on page", p.muted, p.paper],
    ["Muted text on soft band", p.muted, p.subtle],
    ["Link and accent text on page", p.accentLight, p.paper],
    ["Button text on brand colour", p.onPrimary, p.primary],
    ["Body text, dark scheme", p.dInk, p.dPaper],
    ["Muted text, dark scheme", p.dMuted, p.dPaper],
    ["Accent text, dark scheme", p.accentDark, p.dPaper],
  ];
  return pairs.map(([label, fg, bg]) => ({ label, fg, bg, ratio: contrastRatio(fg, bg) ?? 0 }));
}

const FONT = /^[A-Za-z0-9 \-,'"]{1,120}$/;
const stack = (f: string | undefined, fallback: string) => (f && FONT.test(f) ? `${f}, ${fallback}` : fallback);

function css(env: RenderEnv) {
  const p = palette(env.primary);
  const head = stack(env.headingFont, "ui-serif, Georgia, 'Times New Roman', serif");
  const body = stack(env.bodyFont, "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
  const light = `--ink:${p.ink};--paper:${p.paper};--subtle:${p.subtle};--muted:${p.muted};--rule:${p.rule};--brand:${p.primary};--on-brand:${p.onPrimary};--accent:${p.accentLight};`;
  const dark = `--ink:${p.dInk};--paper:${p.dPaper};--subtle:${p.dSubtle};--muted:${p.dMuted};--rule:${p.dRule};--brand:${p.primary};--on-brand:${p.dPrimaryOn};--accent:${p.accentDark};`;
  const scheme = env.scheme === "dark" ? `:root{${light}${dark}color-scheme:dark}` : env.scheme === "light" ? `:root{${light}color-scheme:light}` : `:root{${light}color-scheme:light dark}@media (prefers-color-scheme:dark){:root{${dark}}}`;
  return `${scheme}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:400 1.0625rem/1.65 ${body};-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:${head};line-height:1.12;letter-spacing:-.01em;margin:0}
a{color:var(--accent);text-underline-offset:.2em}
a:focus-visible,summary:focus-visible,.btn:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.skip{position:absolute;left:-999px;top:0;background:var(--brand);color:var(--on-brand);padding:.6rem 1rem;z-index:10}.skip:focus{left:0}
.wrap{max-width:68rem;margin:0 auto;padding:0 1.5rem}
.btn{display:inline-block;background:var(--brand);color:var(--on-brand);font-weight:600;text-decoration:none;padding:.85rem 1.6rem;border-radius:.5rem;border:2px solid var(--brand)}
.btn:hover{filter:brightness(1.06)}
.eyebrow{font:600 .8rem/1 ${body};letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 1rem}
section{padding:5rem 0}section+section{border-top:1px solid var(--rule)}
section h2{font-size:clamp(1.7rem,3.4vw,2.5rem);max-width:22ch;margin-bottom:2rem}
.hero{padding:5.5rem 0 5rem}.hero .grid{display:grid;grid-template-columns:1.15fr .85fr;gap:3.5rem;align-items:center}
.hero h1{font-size:clamp(2.4rem,6vw,4.4rem);max-width:15ch}
.hero p.sub{font-size:1.25rem;color:var(--muted);max-width:34rem;margin:1.5rem 0 2.25rem}
.hero img{width:100%;height:auto;border-radius:.75rem;display:block;background:var(--subtle)}
.problem ul{list-style:none;margin:0;padding:0;max-width:44rem;border-top:1px solid var(--rule)}
.problem li{padding:1.1rem 0;border-bottom:1px solid var(--rule);font-size:1.2rem}
.how ol{list-style:none;margin:0;padding:0;max-width:46rem;counter-reset:s}
.how li{counter-increment:s;position:relative;padding:0 0 2rem 3.5rem}
.how li::before{content:counter(s);position:absolute;left:0;top:-.1rem;width:2.4rem;height:2.4rem;border-radius:50%;background:var(--brand);color:var(--on-brand);font-weight:700;display:grid;place-items:center}
.how li:not(:last-child)::after{content:"";position:absolute;left:1.15rem;top:2.5rem;bottom:.2rem;width:2px;background:var(--rule)}
.how h3{font-size:1.25rem;margin-bottom:.3rem}.how p{margin:0;color:var(--muted)}
.proof{background:var(--subtle)}.proof ul{list-style:none;margin:0;padding:0;display:grid;gap:1.25rem;max-width:48rem}
.proof li{border-left:4px solid var(--brand);padding:.2rem 0 .2rem 1.25rem}
.proof .claim{font:600 1.3rem/1.35 ${head};margin:0}.proof .ev{margin:.35rem 0 0;color:var(--muted)}
.proof .src{display:inline-block;margin-top:.5rem;font-size:.85rem;color:var(--muted);border:1px solid var(--rule);border-radius:999px;padding:.1rem .7rem}
.cmp{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:34rem}
caption{text-align:left;color:var(--muted);padding-bottom:.75rem;font-size:.95rem}
th,td{text-align:left;padding:.85rem 1rem;border-bottom:1px solid var(--rule);vertical-align:top}
thead th{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
tbody th{font-weight:600}tr.ours th,tr.ours td{background:var(--subtle)}
.faq details{border-bottom:1px solid var(--rule);max-width:46rem}.faq summary{cursor:pointer;font:600 1.15rem/1.4 ${head};padding:1.1rem 0;list-style:none}
.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";float:right;color:var(--accent);font-size:1.4rem}
.faq details[open] summary::after{content:"\\2212"}.faq details p{margin:0 0 1.25rem;color:var(--muted)}
.price{background:var(--brand);color:var(--on-brand);text-align:center}.price h2{color:var(--on-brand)}.price h2{margin:0 auto 1rem;max-width:20ch}
.price .amount{font:700 clamp(2.4rem,6vw,3.8rem)/1 ${head};margin:1rem 0}.price p{margin:.5rem auto 2rem;max-width:34rem}
.price .btn{background:var(--on-brand);color:var(--brand);border-color:var(--on-brand)}.price .btn:focus-visible{outline-color:var(--on-brand)}
footer{padding:2.5rem 0 3.5rem;color:var(--muted);font-size:.95rem;border-top:1px solid var(--rule)}footer ul{list-style:none;padding:0;margin:1rem 0 0;display:flex;gap:1.5rem;flex-wrap:wrap}
@media (max-width:760px){.hero .grid{grid-template-columns:1fr;gap:2rem}section{padding:3.5rem 0}.hero{padding:3.5rem 0}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;
}

// ---- sections ----------------------------------------------------------------------------------

type Ctx = { env: RenderEnv; images: { fileId: number; file: string }[]; problems: string[] };
const str = (x: Record<string, unknown>, k: string) => (typeof x[k] === "string" ? (x[k] as string) : "");
const arr = <T,>(x: Record<string, unknown>, k: string) => (Array.isArray(x[k]) ? (x[k] as T[]) : []);

function hero(x: Record<string, unknown>, k: Ctx) {
  const fileId = typeof x.imageFileId === "number" ? x.imageFileId : null;
  let img = "";
  if (fileId !== null) {
    const alt = str(x, "imageAlt").trim();
    const ref = k.env.image(fileId);
    if (!alt) k.problems.push("The hero image has no alt text. Every image needs a short description.");
    else if (ref) {
      k.images.push({ fileId, file: ref.file });
      img = `<img src="${esc(ref.src)}" alt="${esc(alt)}" width="800" height="800" loading="eager">`;
    } else k.problems.push("The hero image file is not in this concept any more.");
  }
  return `<section class="hero" aria-labelledby="h-hero"><div class="wrap grid"><div><p class="eyebrow">${esc(k.env.name)}</p><h1 id="h-hero">${esc(str(x, "headline"))}</h1>${str(x, "subhead") ? `<p class="sub">${esc(str(x, "subhead"))}</p>` : ""}<a class="btn" href="${esc(safeHref(x.ctaHref))}">${esc(str(x, "ctaLabel") || "Get it")}</a></div>${img ? `<div>${img}</div>` : ""}</div></section>`;
}

const section = (id: string, cls: string, inner: string) => `<section class="${cls}" aria-labelledby="${id}"><div class="wrap">${inner}</div></section>`;

function render(kind: LandingKind, x: Record<string, unknown>, k: Ctx, n: number): string {
  const id = `h-${kind}-${n}`;
  switch (kind) {
    case "hero":
      return hero(x, k);
    case "problem":
      return section(id, "problem", `<h2 id="${id}">${esc(str(x, "heading"))}</h2><ul>${arr<string>(x, "points").map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`);
    case "how":
      return section(id, "how", `<h2 id="${id}">${esc(str(x, "heading"))}</h2><ol>${arr<{ title: string; text: string }>(x, "steps").map((st) => `<li><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></li>`).join("")}</ol>`);
    case "proof": {
      const items = arr<{ claim: string; evidence: string; proofItemId: number }>(x, "items").flatMap((it) => {
        const label = k.env.proofLabel(it.proofItemId);
        if (!label) {
          k.problems.push(`A proof line ("${it.claim.slice(0, 40)}") links to a row that is gone or no longer proves anything, so it is left out.`);
          return [];
        }
        return [`<li><p class="claim">${esc(it.claim)}</p>${it.evidence ? `<p class="ev">${esc(it.evidence)}</p>` : ""}<span class="src">${esc(label)}</span></li>`];
      });
      return items.length ? section(id, "proof", `<h2 id="${id}">${esc(str(x, "heading"))}</h2><ul>${items.join("")}</ul>`) : "";
    }
    case "comparison": {
      const ids = new Set(arr<number>(x, "competitorIds"));
      const rows = k.env.competitors.filter((r) => ids.has(r.id) && isSourced(r));
      if (!rows.length) {
        k.problems.push("The comparison has no sourced competitor rows, so it is left out.");
        return "";
      }
      const our = str(x, "ourLine");
      return section(
        id,
        "cmp",
        `<h2 id="${id}">${esc(str(x, "heading"))}</h2><table><caption>${esc(str(x, "intro") || "Each row below is taken from the maker's own page; the link is its source.")}</caption><thead><tr><th scope="col">Option</th><th scope="col">Price</th><th scope="col">What it says</th><th scope="col">Source</th></tr></thead><tbody>${our ? `<tr class="ours"><th scope="row">${esc(k.env.name)}</th><td>${esc(k.env.priceText(null) ?? "")}</td><td>${esc(our)}</td><td></td></tr>` : ""}${rows.map((r) => `<tr><th scope="row">${esc(r.title)}</th><td>${esc(r.priceText ?? "")}</td><td>${esc(r.claim ?? "")}</td><td><a href="${esc(safeHref(r.sourceUrl))}" rel="noopener noreferrer">Source<span class="sr"> for ${esc(r.title)}</span></a></td></tr>`).join("")}</tbody></table>`
      );
    }
    case "faq":
      return section(id, "faq", `<h2 id="${id}">${esc(str(x, "heading"))}</h2>${arr<{ q: string; a: string }>(x, "items").map((it) => `<details><summary>${esc(it.q)}</summary><p>${esc(it.a)}</p></details>`).join("")}`);
    case "price": {
      const pt = k.env.priceText(typeof x.priceItemId === "number" ? x.priceItemId : null);
      if (pt === null) k.problems.push("The price section has no approved price row, so it says the price is to be confirmed.");
      return section(id, "price", `<h2 id="${id}">${esc(str(x, "heading"))}</h2><div class="amount">${esc(pt ?? "Price to be confirmed")}</div>${str(x, "note") ? `<p>${esc(str(x, "note"))}</p>` : ""}<a class="btn" href="${esc(safeHref(x.ctaHref))}">${esc(str(x, "ctaLabel") || "Order")}</a>`);
    }
    case "footer":
      return `<footer><div class="wrap"><p>${esc(str(x, "text"))}</p>${arr<{ label: string; href: string }>(x, "links").length ? `<ul>${arr<{ label: string; href: string }>(x, "links").map((l) => `<li><a href="${esc(safeHref(l.href))}">${esc(l.label)}</a></li>`).join("")}</ul>` : ""}</div></footer>`;
  }
}

/** Sections in their order, drawn. Draft sections are drawn too; `unapproved` lists them. */
export function renderPage(sections: LandingSection[], env: RenderEnv): Rendered & { unapproved: number[] } {
  const k: Ctx = { env, images: [], problems: [] };
  const ordered = [...sections].sort((a, b) => a.order - b.order || a.id - b.id);
  const main = ordered.map((s, n) => (s.kind === "footer" ? "" : render(s.kind, s.content, k, n))).join("\n");
  const foot = ordered.map((s, n) => (s.kind === "footer" ? render(s.kind, s.content, k, n) : "")).join("\n");
  const title = esc(`${str(ordered.find((s) => s.kind === "hero")?.content ?? {}, "headline") || env.name}`);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${env.brandVars ?? ""}
${css(env)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<main id="main">
${main}
</main>
${foot}
</body>
</html>`;
  return { html, images: k.images, problems: k.problems, unapproved: ordered.filter((s) => s.status !== "approved").map((s) => s.id) };
}
