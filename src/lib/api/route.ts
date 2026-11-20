import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { q } from "@/lib/db";

/** Thrown inside a route to answer with a specific status and a plain message. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} was not found.`);

const PG: Record<string, [number, string]> = {
  "22P02": [400, "A value in the request has the wrong format."],
  "22003": [400, "A number in the request is out of range."],
  "22001": [400, "A value in the request is too long."],
  "23502": [400, "A required value is missing."],
  "23503": [404, "The concept or record this refers to does not exist."],
  "23505": [409, "That already exists."],
  "23514": [400, "A value in the request is not allowed."],
};

function fail(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message, ...(e.detail ? { detail: e.detail } : {}) }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const issues = e.issues.map((i) => ({ field: i.path.join(".") || "(body)", problem: i.message }));
    const first = issues[0];
    return NextResponse.json(
      { error: `The request is not valid: ${first.field} — ${first.problem}`, issues },
      { status: 400 }
    );
  }
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string" && PG[code]) {
    const [status, error] = PG[code];
    return NextResponse.json({ error }, { status });
  }
  if ((e as { name?: string })?.name === "TimeoutError" || (e as { name?: string })?.name === "AbortError") {
    return NextResponse.json({ error: "An outside service took too long to answer." }, { status: 504 });
  }
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: "The server could not complete the request." }, { status: 500 });
}

/**
 * Wraps a route handler so every failure leaves as JSON with a real status:
 * validation → 400, missing → 404, conflict → 409, slow upstream → 504, anything else → 500.
 */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      return fail(e);
    }
  };
}

/** Reads and validates a JSON body. A body that is not JSON is a 400, not an empty object. */
export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
  return schema.parse(raw);
}

/** Numeric record ids arrive as path text; anything else is a 404 for that record. */
export function recordId(value: string, what: string): number {
  if (!/^\d{1,15}$/.test(value)) throw notFound(what);
  return Number(value);
}

export async function requireProject(id: string) {
  const rows = await q<{ id: string; name: string; one_liner: string }>(
    "SELECT id, name, one_liner FROM projects WHERE id=$1",
    [id]
  );
  if (!rows.length) throw notFound("That concept");
  return rows[0];
}

/** Outbound calls never hang a request: 60 s unless the caller says otherwise. */
export const outbound = (ms = 60_000) => AbortSignal.timeout(ms);
