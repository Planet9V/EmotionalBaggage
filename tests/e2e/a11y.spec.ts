// Accessibility with axe-core on every page, in both themes. Critical and serious violations both fail.
// The pages are the ones the sidebar and the docs index link to (same list as pages.spec.ts), so a new
// section is covered without editing this file.
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { collectRoutes } from "./helpers";

test.use({ reducedMotion: "reduce" }); // no half-faded cards measured mid-animation

type Found = { critical: string[]; serious: string[] };

async function audit(page: Page, path: string, info: TestInfo): Promise<Found> {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  // The app's only frames are the landing page previews, fully sandboxed (sandbox="", no scripts, opaque
  // origin) on purpose. axe cannot run inside them, and its frame-by-frame run then waits until the test times
  // out (measured: no answer in 60 s; a frame can appear after a check for it has run, so
  // the choice is made for every page, not per page). So axe runs in one pass over the page with frames left
  // out: the page around them, and each frame element's own title, are still checked. A frame that is not
  // sandboxed would be left out too, so the audit fails on one rather than skip it unseen.
  const axe = new AxeBuilder({ page }).options({ iframes: false }).setLegacyMode();
  const result = await axe.analyze();
  const unsandboxed = await page.locator('iframe:not([sandbox=""])').count();
  expect(unsandboxed, `${path} has a frame that is not fully sandboxed; this audit leaves frames out, so give it its own audit`).toBe(0);
  const line = (v: (typeof result.violations)[number]) =>
    `${path} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"}: ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(" "))
      .join(" | ")})`;
  const found = {
    critical: result.violations.filter((v) => v.impact === "critical").map(line),
    serious: result.violations.filter((v) => v.impact === "serious").map(line),
  };
  if (found.critical.length || found.serious.length) {
    await info.attach(`axe${path.replace(/\//g, "_") || "_root"}.json`, { body: JSON.stringify(result.violations, null, 2), contentType: "application/json" });
  }
  return found;
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("the sign-in page has no critical or serious accessibility violations", async ({ page }, info) => {
    const f = await audit(page, "/sign-in", info);
    expect([...f.critical, ...f.serious]).toEqual([]);
  });

  // The public welcome page and its one-page overview, as a visitor with no session sees them, in both themes.
  for (const theme of ["light", "dark"] as const) {
    test(`the welcome page and the overview have no critical or serious accessibility violations in the ${theme} theme`, async ({ page }, info) => {
      await page.addInitScript((t) => window.localStorage.setItem("c2r.theme", t), theme);
      const problems: string[] = [];
      for (const path of ["/welcome", "/welcome/overview"]) {
        const f = await test.step(`${theme} ${path}`, () => audit(page, path, info));
        if (theme === "dark") await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
        problems.push(...f.critical, ...f.serious);
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});

// Each theme's pages are audited in CHUNKS tests, page k going to test k % CHUNKS, so every page is audited
// once per theme and no single test runs long enough to hit its timeout on a slow machine.
const CHUNKS = 6;

for (const theme of ["light", "dark"] as const) {
  for (let chunk = 0; chunk < CHUNKS; chunk++) {
    test(`every page has no critical or serious accessibility violations in the ${theme} theme (part ${chunk + 1} of ${CHUNKS})`, async ({ page }, info) => {
      test.setTimeout(300_000);
      const { routes } = await collectRoutes(page);
      expect(routes.length, "the page list is not empty").toBeGreaterThan(30);
      const mine = routes.filter((_, k) => k % CHUNKS === chunk);
      if (theme === "dark") {
        await page.goto("/");
        await page.locator("aside").getByRole("button", { name: "Dark theme" }).click();
        await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
      }
      const problems: string[] = [];
      for (const path of mine) {
        const f = await test.step(`${theme} ${path}`, () => audit(page, path, info));
        problems.push(...f.critical, ...f.serious);
      }
      info.annotations.push({ type: "pages", description: `${mine.length} of ${routes.length} pages audited in the ${theme} theme` });
      expect(problems, `${problems.length} accessibility violation(s) in the ${theme} theme:\n  ${problems.join("\n  ")}\n`).toEqual([]);
    });
  }
}
