/** Route handlers are called directly with real Request objects against a real PostgreSQL. */
export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export function json(method: string, payload?: unknown, url = "http://test.local/api") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: payload === undefined ? undefined : typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

export async function read<T = Record<string, unknown>>(res: Response) {
  return { status: res.status, body: (await res.json()) as T };
}

export const SEEDED = "baggage-claims";
