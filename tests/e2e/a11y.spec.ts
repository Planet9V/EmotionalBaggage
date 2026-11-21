// Accessibility floor with axe-core: critical violations fail the run; serious ones are reported
// (annotation, attachment, console) so they become work for later without blocking the build.
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page, type TestInfo } from "@playwright/test";

test.use({ reducedMotion: "reduce" }); // no half-faded cards measured mid-animation

async function audit(page: Page, path: string, info: TestInfo) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page }).analyze();
  const line = (v: (typeof result.violations)[number]) =>
    `${path} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"}: ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(" "))
      .join(" | ")})`;
  const critical = result.violations.filter((v) => v.impact === "critical").map(line);
  const serious = result.violations.filter((v) => v.impact === "serious").map(line);
  for (const s of serious) {
    info.annotations.push({ type: "a11y serious", description: s });
    console.log(`[a11y serious] ${s}`);
  }
  await info.attach(`axe${path.replace(/\//g, "_") || "_root"}.json`, { body: JSON.stringify(result.violations, null, 2), contentType: "application/json" });
  expect(critical, `critical accessibility violations on ${path}:\n  ${critical.join("\n  ")}\n`).toEqual([]);
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("sign-in page has no critical accessibility violations", async ({ page }, info) => {
    await audit(page, "/sign-in", info);
  });
});

test("overview has no critical accessibility violations", async ({ page }, info) => {
  await audit(page, "/", info);
});

test("a section page (brief) has no critical accessibility violations", async ({ page }, info) => {
  await audit(page, "/s/concept/brief", info);
});
