// The sidebar at short window heights, light and dark: the header stays at the top, the theme and session
// rows stay pinned at the bottom, and every link in between can be reached by scrolling the one region.
import { test, expect, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("c2r.theme", t), theme);
  await page.reload();
  await expect(page.locator("aside").getByRole("button", { name: theme === "dark" ? "Light theme" : "Dark theme" })).toBeVisible();
}

for (const height of [720, 900]) {
  for (const theme of ["light", "dark"] as const) {
    test(`at ${height} px high (${theme}): header and session rows stay in view and the last link can be reached`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height });
      await setTheme(page, theme);
      const aside = page.locator("aside");
      await expect(aside.getByRole("navigation", { name: "Workbench" })).toBeAttached();

      const box = async (name: string) => (await aside.getByRole("button", { name }).boundingBox())!;
      const newConcept = await box("New concept");
      const theme_ = await box(theme === "dark" ? "Light theme" : "Dark theme");
      const signOut = await box("Sign out");
      expect(newConcept.y).toBeGreaterThanOrEqual(0);
      expect(signOut.y + signOut.height).toBeLessThanOrEqual(height);
      expect(theme_.y + theme_.height).toBeLessThanOrEqual(signOut.y);

      // the scrolling region sits between them and is not squeezed to nothing
      const region = await aside.evaluate((a) => {
        const el = [...a.querySelectorAll<HTMLElement>("div")].find((d) => /(auto|scroll)/.test(getComputedStyle(d).overflowY) && d.querySelector("nav"));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, scrolls: el.scrollHeight > el.clientHeight };
      });
      expect(region, "one scrolling region holds the navigation").not.toBeNull();
      expect(region!.bottom - region!.top).toBeGreaterThan(height * 0.4);
      expect(region!.top).toBeGreaterThanOrEqual(newConcept.y + newConcept.height);
      expect(region!.bottom).toBeLessThanOrEqual(theme_.y + 1);

      // the last link is reachable, and when it scrolls into view it sits inside the region, above the pinned rows
      const last = aside.getByRole("link", { name: "Documentation" });
      await last.scrollIntoViewIfNeeded();
      const l = (await last.boundingBox())!;
      expect(l.y + l.height).toBeLessThanOrEqual(region!.bottom + 1);
      expect(l.y).toBeGreaterThanOrEqual(region!.top - 1);
    });
  }
}

// D16: below 1024 px the sidebar is a drawer, opened by a labelled button, that keeps focus inside it.
test("at 820 px wide the sidebar is a drawer opened from the Menu button", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/s/design/bom");
  await expect(page.locator("aside").first()).toBeHidden();
  const open = page.getByRole("button", { name: "Menu" });
  await expect(open).toBeVisible();
  await open.click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("navigation", { name: "Stages" })).toBeVisible();
  // focus stays in the drawer
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+Tab");
  expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  // following a link closes it
  await open.click();
  await drawer.getByRole("link", { name: "Schematic" }).click();
  await expect(page).toHaveURL(/\/s\/design\/schematic$/);
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
});
