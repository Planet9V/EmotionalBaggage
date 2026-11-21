import { expect, type Page, type TestInfo } from "@playwright/test";

export const SESSION_COOKIE = "c2r_session";

/** Signs in through the form, the way a person does, and waits for the overview. */
export async function signIn(page: Page, username = "demo", password = "demo") {
  await page.goto("/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

export async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
}

/**
 * Same-origin requests a page makes that may answer 4xx/5xx on purpose. Each needs a reason.
 * `path` is matched against the request's path; `page` against the page being checked.
 */
export const ALLOWED_FAILED_REQUESTS: { page: RegExp; path: RegExp; status: number; reason: string }[] = [];

/**
 * Routes other branches are adding (admin, chat, concepts). Each is checked like any page when it
 * answers 200, and reported as "not present" when it answers 404. Any other answer is a failure.
 */
export const OPTIONAL_ROUTES = ["/admin", "/chat", "/concepts"];

/** Pages not in the sidebar that must always be checked. Sidebar and docs links are collected from the page. */
export const FIXED_ROUTES = ["/", "/plan", "/report", "/integrations", "/docs", "/account", "/new", "/drafts", "/optimise"];

type Bucket = { pageErrors: string[]; consoleErrors: string[]; failedRequests: string[] };

/**
 * Watches one page for uncaught errors, console errors and failed same-origin requests.
 * `start(path)` begins a fresh record for the page about to be opened.
 */
export function watch(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  let current = "";
  let bucket: Bucket = { pageErrors: [], consoleErrors: [], failedRequests: [] };
  page.on("pageerror", (e) => bucket.pageErrors.push(`${e.name}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const loc = m.location();
    bucket.consoleErrors.push(`${m.text()}${loc.url ? ` (${loc.url}:${loc.lineNumber})` : ""}`);
  });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin || r.status() < 400) return;
    const allowed = ALLOWED_FAILED_REQUESTS.some((a) => a.page.test(current) && a.path.test(u.pathname) && a.status === r.status());
    if (!allowed) bucket.failedRequests.push(`${r.request().method()} ${u.pathname}${u.search} -> ${r.status()}`);
  });
  page.on("requestfailed", (r) => {
    const u = new URL(r.url());
    const why = r.failure()?.errorText ?? "failed";
    // A request cut off because the page moved on is not a fault of the page.
    if (u.origin !== origin || why.includes("ERR_ABORTED")) return;
    bucket.failedRequests.push(`${r.method()} ${u.pathname}${u.search} -> ${why}`);
  });
  return {
    start(path: string) {
      current = path;
      bucket = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    },
    get bucket() {
      return bucket;
    },
  };
}

/**
 * Opens `path` and checks it: answers 200, stays on its own address, shows a level-one heading,
 * raises no uncaught error, logs no console error and makes no failed same-origin request.
 * Returns the problems found (empty when the page passes).
 */
export async function checkPage(page: Page, w: ReturnType<typeof watch>, path: string, theme: "light" | "dark", info: TestInfo) {
  const problems: string[] = [];
  w.start(path);
  const res = await page.goto(path, { waitUntil: "load" });
  if (!res) problems.push("no response");
  else if (res.status() !== 200) problems.push(`answered ${res.status()}`);
  try {
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  } catch {
    problems.push("no visible level-one heading");
  }
  await page.waitForLoadState("networkidle");
  const html = page.locator("html");
  try {
    if (theme === "dark") await expect(html).toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5_000 });
    else await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5_000 });
  } catch {
    problems.push(`page is not in the ${theme} theme`);
  }
  const landed = new URL(page.url()).pathname;
  if (landed !== path) problems.push(`moved to ${landed}`);
  const b = w.bucket;
  for (const e of b.pageErrors) problems.push(`uncaught error: ${e}`);
  for (const e of b.consoleErrors) problems.push(`console error: ${e}`);
  for (const e of b.failedRequests) problems.push(`failed request: ${e}`);
  if (problems.length) {
    await info.attach(`${theme}${path.replace(/\//g, "_") || "_root"}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  }
  return problems;
}

/**
 * Every page to check: the fixed routes, every link in the rendered sidebar, every guide linked from
 * /docs, and each optional route that answers 200. Optional routes answering 404 come back in
 * `notPresent`; any other answer is a problem.
 */
export async function collectRoutes(page: Page) {
  await page.goto("/");
  const sidebar = page.locator("aside");
  await expect(sidebar.getByRole("navigation", { name: "Stages" }).getByRole("link").first()).toBeVisible();
  // The account link appears once the session is read; wait for it so it is collected too.
  await expect(sidebar.locator('a[href="/account"]').first()).toBeVisible();
  const fromSidebar = await sidebar.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));

  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const fromDocs = await page.locator('main a[href^="/docs/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));

  const notPresent: string[] = [];
  const problems: string[] = [];
  const optional: string[] = [];
  for (const r of OPTIONAL_ROUTES) {
    const res = await page.request.get(r, { maxRedirects: 0 });
    if (res.status() === 200) optional.push(r);
    else if (res.status() === 404) notPresent.push(r);
    else problems.push(`${r}: optional route answered ${res.status()} (expected 200, or 404 while it is not built)`);
  }
  const routes = [...new Set([...FIXED_ROUTES, ...fromSidebar.map((h) => h.split(/[?#]/)[0]!), ...fromDocs, ...optional])];
  return { routes, notPresent: notPresent.filter((r) => !routes.includes(r)), problems, sidebarCount: fromSidebar.length, docsCount: fromDocs.length };
}
