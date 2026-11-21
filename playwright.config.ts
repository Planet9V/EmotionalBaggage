// Browser smoke test (plan item 1.9): opens the production standalone build in Chromium.
// Build first (`npm run build`), then `npm run test:e2e`. tests/e2e/server.mjs recreates the e2e
// database, starts the planner and the app; see the developer guide's Tests section.
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3210";
const BASE_URL = `http://127.0.0.1:${PORT}`;
export const STORAGE_STATE = "tests/e2e/.auth/demo.json";

// E2E_CHROME=system uses the installed Google Chrome instead of Playwright's own Chromium
// (for machines where `npx playwright install chromium` cannot download).
const systemChrome = process.env.E2E_CHROME === "system";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(systemChrome ? { channel: "chrome", launchOptions: { args: ["--no-sandbox"] } } : {}),
  },
  projects: [
    { name: "signed-out", testMatch: /signed-out\.spec\.ts$/ },
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    { name: "signed-in", testMatch: /(pages|save|a11y|keyboard|sidebar)\.spec\.ts$/, dependencies: ["setup"], use: { storageState: STORAGE_STATE } },
    // Signs in a session of its own and ends it, so the stored session above stays valid.
    { name: "sign-out", testMatch: /sign-out\.spec\.ts$/ },
  ],
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: `${BASE_URL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    // Merged over the environment, so E2E_DATABASE_URL passes through as set.
    env: { E2E_PORT: PORT },
  },
});
