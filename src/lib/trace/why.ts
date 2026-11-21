// The optional "why" that goes with a change: kept on the event as `data.reason`, shown in History, Activity,
// the Process history and the audit log. Only a gate override needs one (src/lib/process/schemas.ts).
import { z } from "zod";
import { HttpError } from "@/lib/api/route";

export const WHY_MAX = 1000;

/** One optional reason, trimmed; an empty text is no reason. */
export const whyField = z.string().max(WHY_MAX, `Keep the reason under ${WHY_MAX.toLocaleString("en")} characters.`).trim().optional();

/** What a reason adds to an event's data: nothing when there is none. */
export const reasonDetail = (why: string | undefined | null): { reason?: string } => (why && why.trim() ? { reason: why.trim() } : {});

/** The `why` of a request whose body is optional (archive, delete, approve): a missing body is no reason. */
export async function optionalWhy(req: Request): Promise<string> {
  const text = await req.text();
  if (!text.trim()) return "";
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  return z.object({ why: whyField }).parse({ why: (raw as { why?: unknown }).why }).why ?? "";
}
