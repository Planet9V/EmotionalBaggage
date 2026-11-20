/**
 * fetch with JSON headers and the server's error message as the thrown Error. Pass `signal` in `init` to make it cancellable.
 *
 * A 401 means the session is missing or has ended: the browser is sent to the sign-in page with
 * the current address as `next`, so it comes back here after signing in. On the sign-in page
 * itself a 401 is a wrong password and is only thrown.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
    const here = window.location.pathname + window.location.search;
    // A full page load, not a client-side route change: it drops every cached answer of the old session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- outside React, no router here
    window.location.assign(`/sign-in?next=${encodeURIComponent(here)}`);
  }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}
