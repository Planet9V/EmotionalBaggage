/**
 * However often it is used, a session ends a fixed time after it began (the old sign-in's 90 days, robustness
 * review S9). Better Auth 1.7.27 slides a session's end forward on use and has no absolute limit, so this wraps
 * its database adapter: when a session's end is moved, it is moved no later than its start plus `maxMs`.
 */
import type { DBAdapter } from "better-auth/adapters";

const SESSION = "session";

export function capSessionLife<A extends DBAdapter>(inner: A, maxMs: number): A {
  const cap = async (where: Parameters<DBAdapter["update"]>[0]["where"], update: Record<string, unknown>, via: DBAdapter) => {
    const end = update.expiresAt;
    if (!(end instanceof Date)) return update;
    const row = await via.findOne<{ createdAt: Date | string }>({ model: SESSION, where });
    if (!row) return update;
    const limit = new Date(new Date(row.createdAt).getTime() + maxMs);
    return end.getTime() > limit.getTime() ? { ...update, expiresAt: limit } : update;
  };
  const wrap = (a: DBAdapter): DBAdapter => ({
    ...a,
    async update(args) {
      if (args.model !== SESSION) return a.update(args);
      return a.update({ ...args, update: await cap(args.where, args.update, a) });
    },
    transaction(callback) {
      return a.transaction((trx) => callback(wrap(trx as unknown as DBAdapter) as unknown as typeof trx));
    },
  });
  return wrap(inner) as A;
}
