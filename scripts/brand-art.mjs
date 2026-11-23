// Writes the product's icon files and its social card from their drawings in code
// (src/components/welcome/brandArt.tsx, which draws the tag from the film's own outline):
//   src/app/icon.svg         the browser's icon, vector: it shows more of the tag the larger it is drawn
//   src/app/favicon.ico      16, 32 and 48 px, each drawn at its own level of detail
//   src/app/apple-icon.png   180 px, on the page's dark ground
//   public/landing/og.png    the social card, 1200 by 630
// Run it again after changing the drawings:  node scripts/brand-art.mjs [--sheet <folder>]
// It needs the dev dependencies and a Chrome that Playwright can start (PW_CHANNEL=chrome for the system's).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sheetAt = process.argv.includes("--sheet") ? process.argv[process.argv.indexOf("--sheet") + 1] : null;

// the drawings are TSX: Vite (which the tests already run on) loads them for this script
const vite = await createServer({ configFile: false, root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { "@": path.join(root, "src") } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true } });
const { TagIcon, TagTile, SocialCard } = await vite.ssrLoadModule("/src/components/welcome/brandArt.tsx");
const art = {
  icon: (detail) => renderToStaticMarkup(createElement(TagIcon, { detail })),
  liveIcon: () => renderToStaticMarkup(createElement(TagIcon, { live: true })),
  tile: (rounded) => renderToStaticMarkup(createElement(TagTile, { rounded })),
  card: () => renderToStaticMarkup(createElement(SocialCard)),
};
await vite.close();

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const font = pathToFileURL(path.join(root, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")).href;
const html = (body, w, h, bg = "transparent") =>
  `<!doctype html><style>@font-face{font-family:'Inter Variable';src:url(${font});font-weight:100 900}html,body{margin:0;background:${bg}}svg{display:block;width:${w}px;height:${h}px}svg.tag{width:100%;height:auto}</style>${body}`;
async function shot(body, w, h, { clear = true, type = "png" } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html(body, w, h));
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: clear, type });
}

/** An .ico file holding PNG images, one per size. */
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

const detailFor = (size) => (size <= 20 ? "silhouette" : size <= 48 ? "stitched" : "full");
const out = (p) => path.join(root, p);
await writeFile(out("src/app/icon.svg"), art.liveIcon() + "\n");
const sizes = [16, 32, 48];
const pngs = [];
for (const size of sizes) pngs.push({ size, png: await shot(art.icon(detailFor(size)), size, size) });
await writeFile(out("src/app/favicon.ico"), ico(pngs));
await writeFile(out("src/app/apple-icon.png"), await shot(art.tile(false), 180, 180, { clear: false }));
await writeFile(out("public/landing/og.png"), await shot(art.card(), 1200, 630, { clear: false }));

if (sheetAt) {
  // for judging: each size on a light and a dark tab bar, and the social card
  await mkdir(sheetAt, { recursive: true });
  const b64 = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
  const big = { 16: pngs[0].png, 32: pngs[1].png, 180: await readFile(out("src/app/apple-icon.png")), 512: await shot(art.tile(true), 512, 512) };
  const svg = `data:image/svg+xml;base64,${Buffer.from(art.liveIcon()).toString("base64")}`;
  const bar = (bg, fg, tab) => `<div style="background:${bg};color:${fg};padding:28px 32px;display:flex;gap:36px;align-items:flex-end;font:13px system-ui">
    <div style="background:${tab};border-radius:10px 10px 0 0;padding:9px 14px;display:flex;gap:8px;align-items:center;width:210px"><img src="${b64(big[16])}" width="16" height="16">Concept to Realization</div>
    <div style="background:${tab};border-radius:10px 10px 0 0;padding:9px 14px;display:flex;gap:8px;align-items:center;width:210px"><img src="${svg}" width="16" height="16">icon.svg at 16</div>
    ${[16, 32].map((s) => `<figure style="margin:0;text-align:center"><img src="${b64(big[s])}" width="${s}" height="${s}" style="display:block;margin:0 auto 6px"><img src="${b64(big[s])}" width="${s * 4}" height="${s * 4}" style="display:block;margin:0 auto 6px;image-rendering:pixelated">${s} px (and 4x)</figure>`).join("")}
    <figure style="margin:0;text-align:center"><img src="${svg}" width="32" height="32" style="display:block;margin:0 auto 6px"><img src="${svg}" width="64" height="64" style="display:block;margin:0 auto 6px">icon.svg 32, 64</figure>
    <figure style="margin:0;text-align:center"><img src="${b64(big[180])}" width="180" height="180" style="display:block;margin:0 auto 6px;border-radius:40px">180 px</figure>
    <figure style="margin:0;text-align:center"><img src="${b64(big[512])}" width="256" height="256" style="display:block;margin:0 auto 6px">512 px (shown at half)</figure>
  </div>`;
  await page.setViewportSize({ width: 1240, height: 760 });
  await page.setContent(`<body style="margin:0">${bar("#dfe1e5", "#202124", "#ffffff")}${bar("#202124", "#e8eaed", "#35363a")}</body>`);
  await writeFile(path.join(sheetAt, "icon-sheet.png"), await page.screenshot({ fullPage: true }));
  await writeFile(path.join(sheetAt, "icon-512.png"), big[512]);
  await writeFile(path.join(sheetAt, "og.png"), await readFile(out("public/landing/og.png")));
}
await browser.close();
console.log("icon.svg, favicon.ico (16, 32, 48), apple-icon.png, public/landing/og.png written");
