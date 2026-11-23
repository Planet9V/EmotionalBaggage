// Regenerates the screenshots on the public welcome page (/welcome) from the running app. Not part of CI.
//
//   1. Build and start the app against a FRESH database (so the shots show the seeded example concept and
//      nothing else), with the planner running so the order of operations is drawn:
//        npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/
//        PORT=3000 DATABASE_URL=postgresql://.../c2r_fresh PLANNER_URL=http://127.0.0.1:8811 node .next/standalone/server.js
//   2. node scripts/landing-shots.mjs [base URL, default http://127.0.0.1:3000]
//
// It signs in as demo / demo, opens each page in the light and the dark theme at 1440 x 900, captures the
// content area (the sidebar is left out), and has the browser encode it as WebP. Files go to public/landing/.
// Uses the installed Google Chrome when LANDING_CHROME=system (as E2E_CHROME does for the browser tests). The Open
// Graph image is not a screenshot: scripts/brand-art.mjs draws it (public/landing/og.png).
//
// The pages are what a fresh install shows. Nothing is drawn over them.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BASE = (process.argv[2] ?? process.env.LANDING_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = fileURLToPath(new URL("../public/landing/", import.meta.url));
const VIEW = { width: 1440, height: 900 };
/** Height of each capture, in CSS pixels; the width is the content area's. */
const SHOT_HEIGHT = 740;
const QUALITY = 0.8;

/**
 * Each shot: the page, an element to bring to the top of the window (`anchor`, a text or a CSS selector), an
 * optional step before the capture, and how long to let it settle (3D and graphs draw after load).
 */
const SHOTS = [
  { name: "schematic", path: "/s/design/schematic", anchor: { role: "button", name: "Symbols" }, settle: 2500 },
  { name: "model", path: "/s/design/model", anchor: { text: "Parts", exact: true }, settle: 4000 },
  {
    name: "enclosure",
    path: "/s/design/enclosure",
    before: async (page) => {
      await page.getByRole("button", { name: /^Generate with CaseMaker/ }).click();
      await page.getByText("The base is watertight").first().waitFor({ timeout: 90_000 });
    },
    anchor: { text: "The base is watertight", offset: -470 },
    settle: 4000,
  },
  { name: "process", path: "/process", anchor: { text: "Next step", exact: true, offset: -84 }, settle: 1500 },
  { name: "plan", path: "/plan", anchor: { text: "Computed by NetworkX" }, settle: 3000 },
  { name: "social", path: "/s/marketing/social", anchor: { role: "button", name: "Board", offset: -24 }, settle: 1500 },
  { name: "launch", path: "/s/marketing/launch", anchor: null, settle: 1500 },
  { name: "wiring", path: "/s/prototype/wiring", anchor: { text: "Soldering sequence", offset: -40 }, settle: 1500 },
  { name: "chat", path: "/chat", anchor: null, settle: 1500 },
];

function locate(page, a) {
  if (a.role) return page.locator("main").getByRole(a.role, { name: a.name, exact: true }).first();
  return page.getByText(a.text, { exact: !!a.exact }).first();
}

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel("Username").fill("demo");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE}/`);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => window.localStorage.setItem("c2r.theme", t), theme);
}

/** PNG bytes to WebP (or JPEG) bytes, encoded by the browser itself, optionally resized. */
async function encode(page, png, { type = "image/webp", width, height } = {}) {
  const dataUrl = await page.evaluate(
    async ({ b64, type, width, height, quality }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = width ?? img.naturalWidth;
      c.height = height ?? img.naturalHeight;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL(type, quality);
    },
    { b64: png.toString("base64"), type, width, height, quality: QUALITY }
  );
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function capture(page, shot, theme) {
  await setTheme(page, theme);
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  if (shot.before) await shot.before(page);
  if (shot.anchor) {
    const el = locate(page, shot.anchor);
    await el.waitFor();
    const box = await el.boundingBox();
    const y = await page.evaluate(() => window.scrollY);
    await page.evaluate((top) => window.scrollTo(0, Math.max(0, top)), y + (box?.y ?? 0) + (shot.anchor.offset ?? -24));
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(shot.settle);
  const main = await page.locator("main").boundingBox();
  const clip = { x: Math.round(main.x), y: 0, width: Math.round(main.width), height: SHOT_HEIGHT };
  return page.screenshot({ clip });
}

const browser = await chromium.launch(process.env.LANDING_CHROME === "system" ? { channel: "chrome", args: ["--no-sandbox"] } : {});
try {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  await signIn(page);
  mkdirSync(OUT, { recursive: true });
  const sizes = [];
  for (const shot of SHOTS) {
    for (const theme of ["light", "dark"]) {
      const png = await capture(page, shot, theme);
      const webp = await encode(page, png);
      const file = `${shot.name}-${theme}.webp`;
      writeFileSync(`${OUT}${file}`, webp);
      sizes.push([file, webp.length]);
      console.log(`${file}  ${(webp.length / 1024).toFixed(0)} KB`);
    }
  }

  const total = sizes.reduce((s, [, n]) => s + n, 0);
  console.log(`total ${(total / 1024).toFixed(0)} KB in ${sizes.length} files`);
} finally {
  await browser.close();
}
