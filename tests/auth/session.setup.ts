// Vitest setup file (runs before every test file): signs the default `demo` user in for real, so
// json() and form() in tests/api/helpers.ts carry a valid session cookie.
//
// The session is created straight in the database, not through signIn(), so a test that changes
// passwords or trips the sign-in lockout cannot stop the other files from authenticating.
//
// It then closes the app's connection pool and forgets it. tests/db/migrations.test.ts points
// DATABASE_URL at a scratch database before it first uses the pool; a pool left over from here
// would still point at the main test database.
import { beforeAll } from "vitest";
import { setTestSession } from "../api/helpers";

const SETUP_AGENT = "vitest-setup";

beforeAll(async () => {
  const db = await import("@/lib/db");
  const auth = await import("@/lib/auth");
  await db.ready();
  const rows = await db.q<{ id: string }>("SELECT id FROM users WHERE lower(username) = $1", [auth.DEFAULT_USERNAME]);
  if (!rows.length) throw new Error("The default user is missing from the test database.");
  // Sessions from earlier files and runs are no longer needed.
  await db.q("DELETE FROM sessions WHERE user_agent = $1", [SETUP_AGENT]);
  setTestSession(await auth.createSession(Number(rows[0].id), SETUP_AGENT));
  await db.pool().end();
  const g = globalThis as unknown as { __c2rPool?: unknown; __c2rReady?: unknown };
  delete g.__c2rPool;
  delete g.__c2rReady;
});
