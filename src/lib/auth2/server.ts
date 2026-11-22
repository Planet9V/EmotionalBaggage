/**
 * The one Better Auth instance of this process, on the owner's connection, and the handler the catch-all route
 * exports. Nothing here runs while the new sign-in is off.
 *
 * Its settings come from PostgreSQL (./config.ts, resolveAuth2Config): the secret, made and stored on first use,
 * and the base address. In production with no base address stored yet the instance cannot be built: auth2()
 * throws SetupRequired, and only the first-run page (which stores the address its owner confirms) can go on.
 */
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { ownerPool, ready } from "@/lib/db";
import { makeAuth, type Auth2 } from "./auth";
import { resolveAuth2Config, type Auth2Config } from "./config";

export class SetupRequired extends Error {
  constructor() {
    super("The new sign-in has no address yet: create the owner on the first-run page first.");
  }
}

const g = globalThis as unknown as { __c2rAuth2?: { db: Pool; auth: Auth2; key?: string } };

const keyOf = (c: Auth2Config) => createHash("sha256").update(JSON.stringify([c.secret, c.baseURL, c.trustedOrigins])).digest("base64url");

/** Built on first use after the migrations; rebuilt when the pool or the stored settings change. */
export async function auth2(): Promise<Auth2> {
  await ready();
  const db = ownerPool();
  const held = g.__c2rAuth2;
  // A test puts its own instance in place (no key): that one is used as it is.
  if (held && held.db === db && held.key === undefined) return held.auth;
  const config = await resolveAuth2Config(db);
  if (!config.baseURL) throw new SetupRequired();
  const key = keyOf(config);
  if (!held || held.db !== db || held.key !== key) {
    g.__c2rAuth2 = { db, key, auth: makeAuth(db, { secret: config.secret, baseURL: config.baseURL, trustedOrigins: config.trustedOrigins }) };
  }
  return g.__c2rAuth2!.auth;
}

/** The signed-in user of a request (new sign-in), or null; null too while setup is required. */
export async function auth2Session(headers: Headers) {
  let a: Auth2;
  try {
    a = await auth2();
  } catch (e) {
    if (e instanceof SetupRequired) return null;
    throw e;
  }
  return a.api.getSession({ headers });
}
