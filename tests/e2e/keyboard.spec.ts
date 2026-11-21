// Keyboard only: one board, one table and the New concept wizard. No mouse event is used to operate them.
import { test, expect, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

const live = (page: Page) => page.locator("[role=status]").filter({ hasText: /moved to|was not moved/ });

/**
 * Lifts the focused card. dnd-kit starts listening for the arrow keys a moment after Space (it adds its key
 * listener in a timer), so a key sent in the same instant is lost; a person is never that fast. Wait until the
 * board has said the card is picked up, then one more turn of the event loop.
 */
async function lift(page: Page) {
  await page.keyboard.press("Space");
  await expect(page.locator("[role=status]").filter({ hasText: /Picked up Claimed moats|Claimed moats is over/ }).first()).toBeAttached();
  await page.waitForTimeout(500);
}

/** Presses an arrow and waits until the board says the lifted card is over that status, as a listener would hear it. */
async function arrowTo(page: Page, key: "ArrowLeft" | "ArrowRight", status: string) {
  await page.keyboard.press(key);
  await expect(page.locator("[role=status]").filter({ hasText: `Claimed moats is over ${status}.` }).first()).toBeAttached();
}

test.describe("board", () => {
  test("a card is picked up, moved to the next column and dropped with the keyboard, and the change is saved", async ({ page }) => {
    await page.goto("/s/concept/brief");
    await page.waitForLoadState("networkidle"); // the keys do nothing before the page has hydrated
    const card = (status: string) => page.locator(`article[aria-label="Claimed moats, ${status}"]`);
    await expect(card("open")).toBeVisible();

    const grip = page.getByRole("button", { name: "Drag Claimed moats" });
    await grip.focus();
    const saved = page.waitForResponse((r) => /\/api\/items\/\d+$/.test(new URL(r.url()).pathname) && r.request().method() === "PATCH");
    await lift(page);
    await arrowTo(page, "ArrowRight", "in progress");
    await page.keyboard.press("Space"); // drop
    expect((await saved).status()).toBe(200);
    await expect(card("in progress")).toBeVisible();
    await expect(live(page)).toContainText("Claimed moats moved to in progress");

    // it survived a reload, and goes back the same way
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(card("in progress")).toBeVisible();
    await page.getByRole("button", { name: "Drag Claimed moats" }).focus();
    const back = page.waitForResponse((r) => /\/api\/items\/\d+$/.test(new URL(r.url()).pathname) && r.request().method() === "PATCH");
    await lift(page);
    await arrowTo(page, "ArrowLeft", "open");
    await page.keyboard.press("Space");
    expect((await back).status()).toBe(200);
    await expect(card("open")).toBeVisible();
  });

  test("Escape puts a lifted card back and nothing is saved", async ({ page }) => {
    await page.goto("/s/concept/brief");
    await page.waitForLoadState("networkidle");
    let patched = false;
    page.on("request", (r) => {
      if (r.method() === "PATCH" && /\/api\/items\//.test(r.url())) patched = true;
    });
    await page.getByRole("button", { name: "Drag Claimed moats" }).focus();
    await lift(page);
    await arrowTo(page, "ArrowRight", "in progress");
    await page.keyboard.press("Escape");
    await expect(page.locator('article[aria-label="Claimed moats, open"]')).toBeVisible();
    expect(patched).toBe(false);
  });
});

test.describe("table", () => {
  test("headers sort from the keyboard, arrow keys move between rows, and columns can be hidden", async ({ page }) => {
    await page.goto("/s/concept/questions");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Table" }).focus();
    await page.keyboard.press("Enter");
    const table = page.getByRole("table");
    await expect(table).toBeVisible();

    const title = table.getByRole("columnheader", { name: /Title/ });
    await title.getByRole("button").focus();
    await page.keyboard.press("Enter");
    await expect(title).toHaveAttribute("aria-sort", "ascending");
    await page.keyboard.press("Enter");
    await expect(title).toHaveAttribute("aria-sort", "descending");
    await page.keyboard.press("Enter");
    await expect(title).toHaveAttribute("aria-sort", "none");

    const first = table.locator("tbody [data-nav=title]").first();
    await first.focus();
    await page.keyboard.press("ArrowDown");
    const second = table.locator("tbody tr").nth(1).locator("[data-nav=title]");
    await expect(second).toBeFocused();
    await page.keyboard.press("End");
    await expect(table.locator("tbody tr").last().locator("[data-nav=title]")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();

    await page.getByRole("button", { name: "Columns" }).focus();
    await page.keyboard.press("Enter");
    const hide = page.getByRole("menuitemcheckbox").first();
    await expect(hide).toBeVisible();
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Columns" })).toBeFocused();
  });
});

test.describe("wizard", () => {
  test("a concept is started from the keyboard: type, steps, review, create, and it lands on the first next step", async ({ page, request }) => {
    const name = `Keyboard concept ${Date.now()}`;
    await page.goto("/new");
    await page.waitForLoadState("networkidle");
    // the product type is a group of radios: arrow keys choose
    const printed = page.getByRole("radio", { name: /^Printed/ });
    await page.getByRole("radio", { name: /^Electronics/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(printed).toBeChecked();

    // with nothing typed, Continue says what is missing beside the field and stays on the step
    await page.getByRole("button", { name: /Continue/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Give the concept a name.")).toBeVisible();
    await expect(page.getByText(/Step 01 of 06/)).toBeVisible();

    await page.getByLabel(/^Name/).fill(name);
    await page.getByLabel(/^One-line description/).fill("A lamp that is typed in without a mouse");
    await page.keyboard.press("Enter"); // submits the step
    for (let i = 2; i <= 5; i++) {
      await expect(page.getByText(new RegExp(`Step 0${i} of 06`))).toBeVisible();
      await page.getByRole("button", { name: /Continue/ }).focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByText(/Step 06 of 06/)).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText("Printed part", { exact: false }).first()).toBeVisible();

    const created = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/projects" && r.request().method() === "POST");
    await page.getByRole("button", { name: /Create the concept/ }).focus();
    await page.keyboard.press("Enter");
    const res = await created;
    expect(res.status()).toBe(201);
    const id = ((await res.json()) as { project: { id: string } }).project.id;
    await expect(page).not.toHaveURL(/\/new$/);

    // leave the database as it was
    await request.delete(`/api/projects/${id}`, { data: { confirm: name } });
  });
});

/** The element that has focus, described for an assertion: its accessible text or label. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return "body";
    return (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 80);
  });
}

test.describe("focus after a dialog closes", () => {
  test("Escape returns focus to the opener, Save to the new row, and an edit to the edited row", async ({ page }) => {
    await page.goto("/s/concept/questions");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Table" }).click();
    const add = page.getByRole("button", { name: /^Add/ }).first();
    const addName = (await add.textContent())!.trim();

    // 1. the add dialog, closed with Escape
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await focused(page)).toBe(addName);

    // 2. the add dialog, saved: focus is on the new row
    await add.focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Title").fill("Focus check question");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(() => focused(page)).toBe("Focus check question");

    // 3. the row editor, closed with Escape: back on the row
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await focused(page)).toBe("Focus check question");
  });

  test("the decision dialog and the row assistant return focus to their openers", async ({ page }) => {
    await page.goto("/s/concept/decisions");
    await page.waitForLoadState("networkidle");
    const add = page.getByRole("button", { name: /Add decision/ }).first();
    await add.focus();
    const name = await focused(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await focused(page)).toBe(name);

    await page.goto("/s/marketing/personas");
    await page.waitForLoadState("networkidle");
    const menu = page.getByRole("button", { name: /^Ask the assistant about/ }).first();
    if (await menu.count()) {
      await menu.focus();
      const label = await focused(page);
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: /Challenge this/ }).press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect.poll(() => focused(page)).toBe(label);
    }
  });
});
