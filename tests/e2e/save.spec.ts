// One real save through the browser: move a brief card to another status, reload, see it kept, move it back.
import { test, expect, type Page } from "@playwright/test";

const CARD = "One-liner"; // a seeded brief card (src/lib/seed.ts), status "done"

async function moveTo(page: Page, status: string) {
  const saved = page.waitForResponse((r) => /\/api\/items\/\d+$/.test(new URL(r.url()).pathname) && r.request().method() === "PATCH");
  await page.getByLabel(`Move ${CARD} to a status`).selectOption(status);
  const res = await saved;
  expect(res.status(), `PATCH ${new URL(res.url()).pathname}`).toBe(200);
}

test("a status change on the brief is saved and survives a reload", async ({ page }) => {
  await page.goto("/s/concept/brief");
  const card = (status: string) => page.locator(`article[aria-label="${CARD}, ${status}"]`);
  await expect(card("done")).toBeVisible();

  await moveTo(page, "in progress");
  await expect(card("in progress")).toBeVisible();
  await page.reload();
  await expect(card("in progress")).toBeVisible();
  await expect(page.locator('li[data-status="in progress"]').getByRole("button", { name: CARD, exact: true })).toBeVisible();

  await moveTo(page, "done");
  await page.reload();
  await expect(card("done")).toBeVisible();
});
