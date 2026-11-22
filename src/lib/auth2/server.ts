/**
 * The one Better Auth instance of this process, on the owner's connection, and the handler the catch-all route
 * exports. Nothing here runs while AUTH2 is off.
 */
import type { Pool } from "pg";
import { ownerPool, ready } from "@/lib/db";
import { makeAuth, type Auth2 } from "./auth";

const g = globalThis as unknown as { __c2rAuth2?: { db: Pool; auth: Auth2 } };

/** Built on first use after the migrations; rebuilt if the pool was replaced (the tests do that). */
export async function auth2(): Promise<Auth2> {
  await ready();
  const db = ownerPool();
  if (!g.__c2rAuth2 || g.__c2rAuth2.db !== db) g.__c2rAuth2 = { db, auth: makeAuth(db) };
  return g.__c2rAuth2.auth;
}

/** The signed-in user of a request (new sign-in), or null. */
export async function auth2Session(headers: Headers) {
  return (await auth2()).api.getSession({ headers });
}
