/**
 * Step-up: the acting platform administrator types their own password again before a change that reaches another
 * platform administrator, makes someone one, or starts "view as" (owner's ruling of 23 Nov). There was no such
 * pattern before; this is the one small shared check.
 *
 * A wrong password counts towards the administrator's own lock exactly like a failed sign-in (./signInWait.ts), so
 * step-up cannot be used to guess. The password is compared and forgotten: never stored, logged or returned.
 */
import type { Pool } from "pg";
import { verifyPassword } from "@/lib/auth";
import { claimRefusal, claimTry, clearTries, failedTry } from "./signInWait";
import { refuse } from "./workspaces/store";

const CLIENT = "step-up";

export const stepUpRequired = () =>
  refuse("FORBIDDEN", "STEP_UP_REQUIRED", "Enter your own password to confirm this change: it reaches another platform administrator or gives that role.");

/** Refuses unless `password` is the acting administrator's own current password. */
export async function checkStepUp(db: Pool, actorId: string, password: unknown): Promise<void> {
  if (typeof password !== "string" || !password) throw stepUpRequired();
  const r = await db.query<{ email: string; password: string | null }>(
    `SELECT u.email, a.password FROM "user" u LEFT JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential' WHERE u.id = $1`,
    [actorId]
  );
  const row = r.rows[0];
  if (!row?.password) throw stepUpRequired();
  const refused = claimRefusal(await claimTry(db, row.email, CLIENT));
  if (refused) throw refused;
  if (!(await verifyPassword(password, row.password))) {
    await failedTry(db, row.email);
    throw refuse("FORBIDDEN", "STEP_UP_WRONG", "That is not your password. It counts as a failed sign-in.");
  }
  await clearTries(db, row.email, CLIENT);
}
