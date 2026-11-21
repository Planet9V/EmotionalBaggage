// Signs in once; the signed-in tests reuse this session through its storage state.
import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "../../playwright.config";
import { sessionCookie, signIn } from "./helpers";

setup("sign in as demo and keep the session", async ({ page }) => {
  await signIn(page);
  expect(await sessionCookie(page)).toBeDefined();
  await page.context().storageState({ path: STORAGE_STATE });
});
