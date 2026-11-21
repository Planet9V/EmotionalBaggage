// Signed out: the redirect to sign-in, a refused password, a good one, and the form by keyboard.
import { test, expect } from "@playwright/test";
import { sessionCookie } from "./helpers";

test("a signed-out visit to / is sent to /sign-in?next=%2F", async ({ page, request, baseURL }) => {
  const raw = await request.get("/", { maxRedirects: 0 });
  expect(raw.status()).toBe(307);
  const location = new URL(raw.headers()["location"] ?? "", baseURL);
  expect(location.pathname + location.search).toBe("/sign-in?next=%2F");

  await page.goto("/");
  await expect(page).toHaveURL(`${baseURL}/sign-in?next=%2F`);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("a wrong password shows the error and starts no session", async ({ page, baseURL }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Username").fill("demo");
  await page.getByLabel("Password").fill("not-the-password");
  const answer = page.waitForResponse((r) => r.url().endsWith("/api/auth/sign-in") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await answer).status()).toBe(401);
  // The form's own alert (Next.js adds an empty role="alert" route announcer to every page).
  const alert = page.getByRole("alert").and(page.locator("#sign-in-error"));
  await expect(alert).toBeVisible();
  await expect(alert).not.toBeEmpty();
  await expect(page.getByLabel("Password")).toHaveValue("");
  expect(await sessionCookie(page)).toBeUndefined();
  await expect(page).toHaveURL(`${baseURL}/sign-in`);
});

test("demo / demo signs in and lands on the overview", async ({ page, baseURL }) => {
  await page.goto("/sign-in?next=%2F");
  await page.getByLabel("Username").fill("demo");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const cookie = await sessionCookie(page);
  expect(cookie, "the session cookie is set").toBeDefined();
  expect(cookie!.httpOnly, "the session cookie is httpOnly").toBe(true);
});

test("keyboard: Tab reaches username, password and the button in that order, and Enter submits", async ({ page, baseURL }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Username")).toBeFocused(); // autofocus
  // Start again from the top: clicking the heading (not focusable) moves focus off the field and puts
  // the browser's Tab starting point above the form, so the order is checked from the first Tab.
  await page.getByRole("heading", { level: 1, name: "Sign in" }).click();
  await expect(page.getByLabel("Username")).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Username")).toBeFocused();
  await page.keyboard.type("demo");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type("demo");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${baseURL}/`);
  expect(await sessionCookie(page)).toBeDefined();
});
