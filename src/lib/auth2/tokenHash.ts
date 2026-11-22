/**
 * Session tokens stored hashed (owner's ruling; trial finding "Only a hash of the session token in the database:
 * lost").
 *
 * Better Auth 1.7.27 keeps `session.token` in the clear and has no option to hash it. This wraps its database
 * adapter so that, for the `session` model only:
 *
 * - a token written (create, update) is stored as its SHA-256 (base64url, 43 characters);
 * - a token in a condition (`token = x`, `token IN (...)`) is hashed first, so lookups, refreshes and deletes find
 *   the stored row;
 * - a session read back by its token carries the token it was looked up with, so Better Auth sets and refreshes
 *   the cookie with the real token; a session read any other way (a list by user) carries `LISTED` plus the hash,
 *   which no lookup accepts, because a lookup always hashes what it is given.
 *
 * A copy of the database therefore holds no token a browser could present, with or without BETTER_AUTH_SECRET.
 * The cookie is still the token plus Better Auth's signature.
 *
 * Consequence, handled in ./auth.ts: Better Auth endpoints that hand a listed token back to the server
 * (`/list-sessions`, `/revoke-session`) cannot work, so they are switched off, and "sign out my other sessions" is
 * answered by our own statement. A sessions screen (slice 2) addresses sessions by id instead.
 */
import { createHash } from "node:crypto";
import type { DBAdapter, Where } from "better-auth/adapters";

const SESSION = "session";
/** Prefix of the token field on a session that was not looked up by its token. Never a real token. */
const LISTED = "listed:";

export const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");

const hashValue = (v: Where["value"]): Where["value"] =>
  typeof v === "string" ? hashToken(v) : Array.isArray(v) ? (v as unknown[]).map((x) => (typeof x === "string" ? hashToken(x) : x)) as string[] : v;

function hashWhere(where: Where[] | undefined): { where: Where[] | undefined; asked: string | null } {
  if (!where) return { where, asked: null };
  let asked: string | null = null;
  const out = where.map((w) => {
    if (w.field !== "token") return w;
    if ((w.operator ?? "eq") === "eq" && typeof w.value === "string") asked = w.value;
    return { ...w, value: hashValue(w.value) };
  });
  return { where: out, asked };
}

/** The token a caller may see for a stored row: the one it asked with, or the unusable listed form. */
function present<T>(row: T, asked: string | null): T {
  if (!row || typeof row !== "object") return row;
  const r = row as Record<string, unknown>;
  if (typeof r.token !== "string") return row;
  return { ...r, token: asked ?? `${LISTED}${r.token}` } as T;
}

/** Sessions joined onto another model's rows never show a stored hash as a token either. */
function presentJoined<T>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const r = row as Record<string, unknown>;
  const s = r[SESSION];
  if (s === undefined) return row;
  return { ...r, [SESSION]: Array.isArray(s) ? s.map((x) => present(x, null)) : present(s, null) } as T;
}

const hashData = <D extends Record<string, unknown>>(data: D): D =>
  typeof data.token === "string" ? { ...data, token: hashToken(data.token) } : data;

/** The same adapter, with session tokens hashed at rest as described above. */
export function hashSessionTokens<A extends DBAdapter>(inner: A): A {
  const wrapped: DBAdapter = {
    ...inner,
    async create(args) {
      if (args.model !== SESSION) return inner.create(args);
      const token = (args.data as Record<string, unknown>).token;
      const row = await inner.create({ ...args, data: hashData(args.data as Record<string, unknown>) as typeof args.data });
      return present(row, typeof token === "string" ? token : null);
    },
    async findOne(args) {
      if (args.model !== SESSION) return presentJoined(await inner.findOne(args));
      const { where, asked } = hashWhere(args.where);
      return present(await inner.findOne({ ...args, where: where! }), asked);
    },
    async findMany(args) {
      if (args.model !== SESSION) return (await inner.findMany(args)).map((r) => presentJoined(r));
      const { where } = hashWhere(args.where);
      const rows = await inner.findMany({ ...args, where });
      // A lookup of several by token: each row is shown with the token that found it.
      const asked = new Map<string, string>();
      for (const w of args.where ?? []) {
        if (w.field !== "token") continue;
        for (const v of Array.isArray(w.value) ? (w.value as unknown[]) : [w.value]) if (typeof v === "string") asked.set(hashToken(v), v);
      }
      return rows.map((r) => {
        const stored = (r as Record<string, unknown>).token;
        return present(r, typeof stored === "string" ? asked.get(stored) ?? null : null);
      });
    },
    async count(args) {
      return inner.count(args.model === SESSION ? { ...args, where: hashWhere(args.where).where } : args);
    },
    async update(args) {
      if (args.model !== SESSION) return inner.update(args);
      const { where, asked } = hashWhere(args.where);
      const row = await inner.update({ ...args, where: where!, update: hashData(args.update) });
      const fresh = typeof args.update.token === "string" ? args.update.token : asked;
      return present(row, fresh);
    },
    async updateMany(args) {
      if (args.model !== SESSION) return inner.updateMany(args);
      return inner.updateMany({ ...args, where: hashWhere(args.where).where!, update: hashData(args.update) });
    },
    async delete(args) {
      return inner.delete(args.model === SESSION ? { ...args, where: hashWhere(args.where).where! } : args);
    },
    async deleteMany(args) {
      return inner.deleteMany(args.model === SESSION ? { ...args, where: hashWhere(args.where).where! } : args);
    },
    async consumeOne(args) {
      if (args.model !== SESSION) return inner.consumeOne(args);
      const { where, asked } = hashWhere(args.where);
      return present(await inner.consumeOne({ ...args, where: where! }), asked);
    },
    async incrementOne(args) {
      if (args.model !== SESSION) return inner.incrementOne(args);
      const { where, asked } = hashWhere(args.where);
      return present(await inner.incrementOne({ ...args, where: where!, ...(args.set ? { set: hashData(args.set) } : {}) }), asked);
    },
    transaction(callback) {
      return inner.transaction((trx) => callback(hashSessionTokens(trx as unknown as DBAdapter) as unknown as typeof trx));
    },
  };
  return wrapped as A;
}
