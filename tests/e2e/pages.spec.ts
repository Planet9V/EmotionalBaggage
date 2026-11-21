// Every screen, signed in, in the light theme and then in the dark theme (set with the app's own toggle).
// The list of pages is read from the rendered sidebar and the docs index, so a new section is covered
// without editing this file.
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { checkPage, collectRoutes, watch } from "./helpers";

async function runLoop(page: Page, baseURL: string, theme: "light" | "dark", info: TestInfo) {
  const { routes, notPresent, problems, sidebarCount, docsCount } = await collectRoutes(page);
  expect(sidebarCount, "the sidebar has links").toBeGreaterThan(10);
  expect(docsCount, "the docs index links its guides").toBeGreaterThan(0);

  if (theme === "dark") {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(page.locator("aside").getByRole("button", { name: "Light theme" })).toBeVisible();
  }

  const w = watch(page, baseURL);
  for (const path of routes) {
    const found = await test.step(`${theme} ${path}`, () => checkPage(page, w, path, theme, info));
    for (const p of found) problems.push(`${path}: ${p}`);
  }

  for (const r of notPresent) info.annotations.push({ type: "not present", description: `${r} answered 404 (not built on this branch)` });
  info.annotations.push({ type: "pages", description: `${routes.length} pages checked in the ${theme} theme` });
  await info.attach(`pages-${theme}.json`, { body: JSON.stringify({ theme, routes, notPresent }, null, 2), contentType: "application/json" });
  console.log(`[${theme}] ${routes.length} pages checked; not present: ${notPresent.join(", ") || "none"}`);

  expect(problems, `${problems.length} problem(s) in the ${theme} theme:\n  ${problems.join("\n  ")}\n`).toEqual([]);
}

test("every page loads cleanly in the light theme", async ({ page, baseURL }, info) => {
  test.setTimeout(300_000);
  await runLoop(page, baseURL!, "light", info);
});

test("every page loads cleanly in the dark theme", async ({ page, baseURL }, info) => {
  test.setTimeout(300_000);
  await runLoop(page, baseURL!, "dark", info);
});
