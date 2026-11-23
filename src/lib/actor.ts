// Who is doing the work in the current request. route() sets it from the session; the audit log reads it.
// It is carried by Node's AsyncLocalStorage, so nothing has to pass a user name through every call.
import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<string>();

/** Runs `fn` with `actor` as the name recorded against everything it changes. */
export function asActor<T>(actor: string, fn: () => T): T {
  return store.run(actor, fn);
}

/** The signed-in user's name, or "" outside a request (start-up, a migration, a test calling a library directly). */
export function currentActor(): string {
  return store.getStore() ?? "";
}

const viewer = new AsyncLocalStorage<string>();

/**
 * Runs `fn` as a "view as" request (src/lib/auth2/viewAs.ts): every audit line written inside names the
 * administrator as well, "admin as person", whatever actor the line was given.
 */
export function asViewer<T>(admin: string, fn: () => T): T {
  return viewer.run(admin, fn);
}

/** The administrator viewing as someone in this request, or "". */
export function currentViewer(): string {
  return viewer.getStore() ?? "";
}
