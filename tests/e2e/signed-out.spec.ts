// Signed out: the redirect of / to the welcome page and of other pages to sign-in, a refused password, a good one, and the form by keyboard.
import { test, expect } from "@playwright/test";
import { checkPage, sessionCookie, watch } from "./helpers";

test("a signed-out visit to / is sent to /welcome, and other pages still go to /sign-in?next=", async ({ page, request, baseURL }) => {
  const raw = await request.get("/", { maxRedirects: 0 });
  expect(raw.status()).toBe(307);
  const location = new URL(raw.headers()["location"] ?? "", baseURL);
  expect(location.pathname + location.search).toBe("/welcome");

  await page.goto("/");
  await expect(page).toHaveURL(`${baseURL}/welcome`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // the welcome page renders bare: no app sidebar
  await expect(page.locator("aside")).toHaveCount(0);

  for (const path of ["/plan", "/admin", "/report"]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(307);
    const to = new URL(r.headers()["location"] ?? "", baseURL);
    expect(to.pathname + to.search, path).toBe(`/sign-in?next=${encodeURIComponent(path)}`);
  }
});

test("the welcome page's primary call to action opens the sign-in form", async ({ page, baseURL }) => {
  await page.goto("/welcome");
  await page.getByRole("link", { name: "Try the live workbench" }).first().click();
  await expect(page).toHaveURL(`${baseURL}/sign-in`);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`the welcome page and the overview load cleanly signed out in the ${theme} theme`, async ({ page, baseURL }, info) => {
    await page.addInitScript((t) => window.localStorage.setItem("c2r.theme", t), theme);
    const w = watch(page, baseURL!);
    const problems: string[] = [];
    for (const path of ["/welcome", "/welcome/overview"]) problems.push(...(await checkPage(page, w, path, theme, info)).map((p) => `${path}: ${p}`));
    expect(problems).toEqual([]);
    expect(await sessionCookie(page)).toBeUndefined();
  });
}

test("the welcome page's request form stores a request and says plainly that no email is sent", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Request a workspace" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await page.getByLabel(/Your name/).fill("E2E Visitor");
  await page.getByLabel(/^Email/).fill("visitor@example.test");
  await page.getByLabel(/What do you want to build/).fill("A bike light that brakes brighter.");
  const answer = page.waitForResponse((r) => r.url().endsWith("/api/access-requests") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Request a workspace" }).click();
  expect((await answer).status()).toBe(201);
  await expect(page.getByText("We have your request. Nothing is sent by email yet; the owner sees it in Admin.")).toBeVisible();
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
