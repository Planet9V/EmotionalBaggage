/** An API failure: the server's message, its status, and any detail it sent (a 409 on a draft run carries `pending`). */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: { pending?: number }
  ) {
    super(message);
  }
}

/**
 * A 401 means the session is missing or has ended: the browser is sent to the sign-in page with
 * the current address as `next`, so it comes back here after signing in. On the sign-in page
 * itself a 401 is a wrong password and is only thrown by the caller.
 */
function signInOn401(res: Response) {
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
    const here = window.location.pathname + window.location.search;
    // A full page load, not a client-side route change: it drops every cached answer of the old session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- outside React, no router here
    window.location.assign(`/sign-in?next=${encodeURIComponent(here)}`);
  }
}

/**
 * fetch with JSON headers and the server's error message as the thrown ApiError (an Error with `status` and `detail`).
 * Pass `signal` in `init` to make it cancellable. A 401 sends the browser to sign in (see signInOn401).
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: { pending?: number } };
  signInOn401(res);
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.detail);
  return body as T;
}

/**
 * The bytes of a stored file (`/api/files/:id`). The one place the browser reads a file's bytes. A failure throws an
 * ApiError whose message is `failure(status)` when given, else "Request failed (status)"; a 401 sends the browser to sign in.
 */
export async function fetchFileBytes(id: number, failure?: (status: number) => string, init?: RequestInit): Promise<ArrayBuffer> {
  const res = await fetch(`/api/files/${id}`, init);
  signInOn401(res);
  if (!res.ok) throw new ApiError(failure?.(res.status) ?? `Request failed (${res.status})`, res.status);
  return res.arrayBuffer();
}
