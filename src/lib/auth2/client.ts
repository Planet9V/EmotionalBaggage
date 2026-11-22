/**
 * The screens' one way to call the new sign-in's API (/api/auth2/...). Answers the parsed body, or a plain sentence
 * for anything that went wrong, including the server being unreachable. Browser-safe: no server import.
 */
import { plainError } from "./errors";

const BASE = "/api/auth2";

export type Answer<T> = { ok: true; data: T } | { ok: false; status: number; code: string; error: string };

export async function call<T = Record<string, unknown>>(path: string, body?: unknown): Promise<Answer<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, status: 0, code: "", error: "The server could not be reached. Check your connection and try again." };
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (res.ok) return { ok: true, data: parsed as T };
  const code = parsed && typeof parsed === "object" && typeof (parsed as { code?: unknown }).code === "string" ? (parsed as { code: string }).code : "";
  return { ok: false, status: res.status, code, error: plainError(res.status, parsed) };
}
