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

test("the welcome page has one action, early access, in reach from the header, and sells two paid plans and nothing else", async ({ page, baseURL }) => {
  await page.goto("/welcome");
  // the header's action goes to the form in the hero; the same words are the action of every block
  await page.getByRole("banner").getByRole("link", { name: "Claim an early-access place" }).click();
  await expect(page).toHaveURL(`${baseURL}/welcome#early-access-hero`);
  await expect(page.getByRole("heading", { level: 1, name: "Your product idea, built and on sale." })).toBeInViewport();
  for (const track of ["cta:get", "cta:proof", "plan:maker", "plan:studio"]) await expect(page.locator(`a[data-track="${track}"]`)).toHaveText("Claim an early-access place");
  // every action is a link to a form that is on the page
  for (const href of await page.locator('a[href^="#early-access-"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) await expect(page.locator(href)).toHaveCount(1);
  // the nine blocks, by their stable ids (the builder block shows only once the owner's name and text are saved)
  for (const id of ["hero", "origin", "problem", "get", "proof", "pricing", "faq", "close"]) await expect(page.locator(`section#${id}`)).toHaveCount(1);
  await page.getByRole("link", { name: "See the worked example" }).click();
  await expect(page).toHaveURL(`${baseURL}/welcome#proof`);
  await expect(page.getByRole("heading", { level: 2, name: "One real product, taken through it" })).toBeInViewport();
  // pricing: Maker and Studio, each with a price; no card that costs nothing and none for running it yourself
  const pricing = page.locator("section#pricing");
  await expect(pricing.getByRole("heading", { level: 4 })).toHaveText(["Maker", "Studio"]);
  await expect(pricing.getByText("Team seats, opening after early access")).toBeVisible();
  await expect(pricing.getByText("Price to be announced")).toHaveCount(0);
  // nothing the page says of the service claims it costs nothing, points at the source, or offers the shared demo
  // (the example's own rows, shown in "What you get" and the proof, are its data and are not read here)
  for (const where of ["header", "section#hero", "section#problem", "section#pricing", "section#faq", "section#close", "footer"]) {
    const text = (await page.locator(where).innerText()).toLowerCase();
    for (const word of ["free", "github", "self-host", "docker", "demo", "request access"]) expect(text, `${where}: ${word}`).not.toContain(word);
  }
  const all = (await page.locator("body").innerText()).toLowerCase();
  for (const word of ["github", "self-host", "docker", "try the live demo", "request access", "run it yourself"]) expect(all, word).not.toContain(word);
  await expect(page.getByRole("contentinfo")).toContainText("Visits to this page are counted on our own server. Nothing is sent to anyone else.");
  await page.getByRole("contentinfo").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseURL}/sign-in`);
});

test("a visitor claims an early-access place from the welcome page and is then asked for the optional details", async ({ page }) => {
  await page.goto("/welcome");
  const form = page.locator("#early-access-close");
  await expect(form.locator("[data-early-count]")).toContainText(/early-access places left|Early access is full/);
  await form.getByLabel(/^Email/).fill(`e2e-${Date.now()}@example.test`);
  await form.getByLabel(/What do you want to make/).fill("A bike light that brakes brighter.");
  const answer = page.waitForResponse((r) => r.url().endsWith("/api/access-requests") && r.request().method() === "POST");
  await form.getByRole("button", { name: /Claim an early-access place|Join the waiting list/ }).click();
  expect((await answer).status()).toBe(201);
  await expect(form.locator("[data-early-answer]")).toBeVisible();
  await expect(form.getByText("Tell us a little more")).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`the welcome page and its early-access page load cleanly signed out in the ${theme} theme`, async ({ page, baseURL }, info) => {
    await page.addInitScript((t) => window.localStorage.setItem("c2r.theme", t), theme);
    const w = watch(page, baseURL!);
    const problems: string[] = [];
    for (const path of ["/welcome", "/welcome/early"]) problems.push(...(await checkPage(page, w, path, theme, info)).map((p) => `${path}: ${p}`));
    expect(problems).toEqual([]);
    expect(await sessionCookie(page)).toBeUndefined();
  });
}

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
