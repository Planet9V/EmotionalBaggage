// Writes the Shipwright mark as an icon set, from its drawing in code (src/components/brand/ShipwrightMark.tsx):
//   public/brand/icon-shipwright.svg         vector, on a dark rounded tile so it reads on light and dark tab bars
//   public/brand/favicon-shipwright.ico      16, 32 and 48 px
//   public/brand/apple-icon-shipwright.png   180 px
// The set is stored, not wired in: the browser's icon is still the luggage tag (scripts/brand-art.mjs, owner,
// 23 Nov). To make this the tab icon, copy the three files over src/app/icon.svg, favicon.ico and apple-icon.png.
// Run it again after changing the drawing:  node scripts/shipwright-art.mjs [--sheet <folder>]
// With --sheet it also writes pictures for judging the mark: the still on dark and light, and the knock in frames.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sheetAt = process.argv.includes("--sheet") ? process.argv[process.argv.indexOf("--sheet") + 1] : null;

const vite = await createServer({ configFile: false, root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { "@": path.join(root, "src") } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true } });
const { ShipwrightMark } = await vite.ssrLoadModule("/src/components/brand/ShipwrightMark.tsx");
await vite.close();
const css = await readFile(path.join(root, "src/components/brand/shipwright.css"), "utf8");
const mark = (props = {}) => renderToStaticMarkup(createElement(ShipwrightMark, props));

const INK = "#f4f4f5", ACCENT = "#f07b37", TILE = "#0b0c0e";
/** The mark on its tile as one self-contained SVG: no stylesheet, the two colours written in. */
function tile(size, rounded = true) {
  const inner = mark({ size: 32 }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/ class="[^"]*sw-accent[^"]*"/g, ` color="${ACCENT}"`).replace(/ class="[^"]*"/g, "").replace(/ pathLength="1"/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="${TILE}"/><g color="${INK}" transform="translate(3.2 2.2) scale(0.8)">${inner}</g></svg>`;
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(body, w, h, { clear = true, bg = "transparent" } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:${bg}}svg{display:block}${css}</style>${body}`);
  return page.screenshot({ omitBackground: clear, type: "png" });
}
function ico(images) {
  const head = Buffer.alloc(6 + images.length * 16);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let at = head.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(at, e + 12);
    at += png.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.png)]);
}

const dir = path.join(root, "public/brand");
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "icon-shipwright.svg"), tile(32) + "\n");
const pngs = [];
for (const size of [16, 32, 48]) pngs.push({ size, png: await shot(tile(size), size, size) });
await writeFile(path.join(dir, "favicon-shipwright.ico"), ico(pngs));
await writeFile(path.join(dir, "apple-icon-shipwright.png"), await shot(tile(180, false), 180, 180, { clear: false }));

if (sheetAt) {
  await mkdir(sheetAt, { recursive: true });
  const themes = { dark: { bg: "#0b0c0e", fg: "#f4f4f5", accent: "#ffa370" }, light: { bg: "#faf8f5", fg: "#18181b", accent: "#c64405" } };
  const row = (t, inner) => `<div style="background:${t.bg};color:${t.fg};--sw-accent:${t.accent};display:flex;align-items:center;gap:40px;padding:36px 44px;font:600 15px 'Inter Variable',Inter,system-ui,sans-serif">${inner}</div>`;
  const sizes = (t) => row(t, `${mark({ size: 320 })}${[96, 48, 28, 24, 20, 16].map((s) => mark({ size: s })).join("")}<span style="display:inline-flex;align-items:center;gap:8px;letter-spacing:-0.01em">${mark({ size: 24 })}Shipwright</span>`);
  for (const [name, t] of Object.entries(themes)) await writeFile(path.join(sheetAt, `mark-still-${name}.png`), await shot(sizes(t), 1000, 392, { clear: false }));
  // the knock, frozen at eight moments: each frame is the animation paused at a negative delay
  const at = [0, 0.3, 0.52, 0.6, 0.76, 0.96, 1.2, 1.6];
  const frame = (s, size) => `<figure style="margin:0;text-align:center;font:500 12px system-ui"><div style="--t:-${s}s">${mark({ size, play: true })}</div><figcaption style="margin-top:10px;opacity:.7">${s.toFixed(2)} s</figcaption></figure>`;
  const strip = (t, size) => row(t, at.map((s) => frame(s, size)).join(""));
  const pause = `<style>.sw-play *{animation-play-state:paused!important;animation-delay:var(--t)!important}</style>`;
  await writeFile(path.join(sheetAt, "mark-filmstrip.png"), await shot(pause + strip(themes.dark, 96) + strip(themes.light, 96) + strip(themes.dark, 28), 1200, 470, { clear: false }));
  const b64 = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
  const tab = (bg, fg, chip) => `<div style="background:${bg};color:${fg};padding:24px 32px;display:flex;gap:32px;align-items:flex-end;font:13px system-ui"><div style="background:${chip};border-radius:10px 10px 0 0;padding:9px 14px;display:flex;gap:8px;align-items:center;width:190px"><img src="${b64(pngs[0].png)}" width="16" height="16">Shipwright</div>${pngs.map((p) => `<img src="${b64(p.png)}" width="${p.size}" height="${p.size}">`).join("")}${tile(96)}</div>`;
  await writeFile(path.join(sheetAt, "favicon-shipwright-sheet.png"), await shot(tab("#dfe1e5", "#202124", "#fff") + tab("#202124", "#e8eaed", "#35363a"), 700, 290, { clear: false }));
}
await browser.close();
console.log("public/brand: icon-shipwright.svg, favicon-shipwright.ico (16, 32, 48), apple-icon-shipwright.png written (not wired in)");
