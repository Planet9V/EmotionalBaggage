// Signing out: a session of its own (not the stored one), ended from the sidebar.
import { test, expect } from "@playwright/test";
import { SESSION_COOKIE, sessionCookie, signIn } from "./helpers";

test("sign out removes the cookie, ends the session on the server, and /plan goes to sign-in", async ({ page, baseURL, playwright }) => {
  await signIn(page);
  const before = await sessionCookie(page);
  expect(before).toBeDefined();

  await page.locator("aside").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${baseURL}/sign-in`);
  expect(await sessionCookie(page), "the cookie is gone").toBeUndefined();

  // The old token no longer works anywhere, not just in this browser.
  const other = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${before!.value}` } });
  expect((await other.get("/api/projects")).status(), "the ended session is refused by the API").toBe(401);
  await other.dispose();

  await page.goto("/plan");
  await expect(page).toHaveURL(`${baseURL}/sign-in?next=%2Fplan`);
});
