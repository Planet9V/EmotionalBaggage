// The per-account sign-in wait (accounts slice 2, step 5; review note N4), through the real route. Better Auth's
// per-address throttle is off in this file so the account rule is seen on its own; tests/auth2/accounts.test.ts and
// review.test.ts cover the per-address one.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { NAME_FREE, NAME_MAX_MS, PAIR_FREE, nameKey } from "@/lib/auth2/signInWait";
import { browser, cleanUp, email, newAccount, PASSWORD, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
  await db.query("DELETE FROM auth2_sign_in_waits");
});

afterAll(async () => {
  await db.query("DELETE FROM auth2_sign_in_waits");
  await cleanUp(db);
  delete process.env.AUTH2;
});

const tryIn = (address: string, who: string, password: string) => browser(route, { address }).post<{ code?: string }>("/sign-in/email", { email: who, password });
/** Moves every wait for a name into the past, as if the time had passed. */
const pass = (who: string) => db.query("UPDATE auth2_sign_in_waits SET next_allowed_at = now() - interval '1 second' WHERE name_key = $1", [nameKey(who)]);

describe("one name from one address", () => {
  it(`after ${PAIR_FREE} wrong passwords the next try waits, and is refused without checking the password`, async () => {
    const a = await newAccount(route, "wait-pair");
    for (let i = 0; i < PAIR_FREE; i++) expect((await tryIn("203.0.113.10", a.email, "wrong password")).status).toBe(401);
    // The fourth is counted and checked (the wait starts after it)...
    expect((await tryIn("203.0.113.10", a.email, "wrong password")).status).toBe(401);
    // ...and the fifth must wait: even the right password is not looked at.
    const res = await tryIn("203.0.113.10", a.email, PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("SIGN_IN_WAIT");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    await pass(a.email);
    expect((await tryIn("203.0.113.10", a.email, PASSWORD)).status).toBe(200);
    expect((await db.query("SELECT 1 FROM auth2_sign_in_waits WHERE name_key = $1", [nameKey(a.email)])).rowCount).toBe(0);
  });

  it("another address is not held up by it", async () => {
    const a = await newAccount(route, "wait-other");
    for (let i = 0; i < PAIR_FREE + 1; i++) await tryIn("203.0.113.11", a.email, "wrong password");
    expect((await tryIn("203.0.113.11", a.email, PASSWORD)).status).toBe(429);
    expect((await tryIn("203.0.113.12", a.email, PASSWORD)).status).toBe(200);
  });

  it("parallel guesses cannot slip past the count", async () => {
    const a = await newAccount(route, "wait-race");
    const all = await Promise.all(Array.from({ length: 8 }, () => tryIn("203.0.113.13", a.email, "wrong password")));
    const checked = all.filter((r) => r.status === 401).length;
    expect(checked).toBeLessThanOrEqual(PAIR_FREE + 1);
    expect(all.filter((r) => r.status === 429).length).toBe(8 - checked);
  });
});

describe("one name from many addresses", () => {
  it(`after ${NAME_FREE} tries spread over addresses, a new address waits too, but never more than a minute`, async () => {
    const a = await newAccount(route, "wait-spread");
    for (let i = 0; i < NAME_FREE + 1; i++) expect((await tryIn(`198.18.0.${i + 1}`, a.email, "wrong password")).status).toBe(401);
    const res = await tryIn("198.18.1.1", a.email, PASSWORD);
    expect([res.status, res.body.code]).toEqual([429, "SIGN_IN_WAIT"]);
    // However long the attack goes on, the name-wide wait is capped: a delay, not a lock.
    await db.query("UPDATE auth2_sign_in_waits SET failures = 500, next_allowed_at = now() - interval '1 second' WHERE name_key = $1 AND client = ''", [nameKey(a.email)]);
    expect((await tryIn("198.18.0.99", a.email, "wrong password")).status).toBe(401);
    const w = await db.query<{ s: number }>("SELECT extract(epoch FROM next_allowed_at - last_attempt_at)::int AS s FROM auth2_sign_in_waits WHERE name_key = $1 AND client = ''", [nameKey(a.email)]);
    expect(w.rows[0].s).toBeLessThanOrEqual(NAME_MAX_MS / 1000);
    expect(w.rows[0].s).toBeGreaterThan(0);
    await pass(a.email);
    expect((await tryIn("198.18.1.1", a.email, PASSWORD)).status).toBe(200);
  });

  it("unknown names are counted like real ones, and names are stored only as hashes", async () => {
    const nobody = email("nobody-here");
    for (let i = 0; i < PAIR_FREE + 1; i++) expect((await tryIn("203.0.113.20", nobody, "wrong password")).status).toBe(401);
    expect((await tryIn("203.0.113.20", nobody, "wrong password")).body.code).toBe("SIGN_IN_WAIT");
    const all = JSON.stringify((await db.query("SELECT * FROM auth2_sign_in_waits")).rows);
    expect(all).not.toContain("@zz-auth2.test");
    expect(all).toContain(nameKey(nobody));
  });
});
