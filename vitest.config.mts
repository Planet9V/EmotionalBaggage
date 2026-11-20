import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    // Starts the real NetworkX planner (planner/) for the run; the plan API test talks to it.
    globalSetup: ["tests/plan/planner.setup.ts"],
    // Signs the default user in before each test file, so json() in tests/api/helpers.ts is authenticated.
    setupFiles: ["tests/auth/session.setup.ts"],
    // The API tests share one PostgreSQL database, so files run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
