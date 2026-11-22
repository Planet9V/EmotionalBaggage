// The buttons a Slack message can carry: a stable key, the role needed to press it, and the value it carries.
// Encoding and decoding only; the handling (checking the person, calling the server function, auditing) is step 3
// of docs/design/slack.md.
//
// A button is one of two kinds. A "link" button opens a page of the app (its address is part of the message, no value
// is carried). An "action" button carries a compact value that Slack sends back unchanged; the value is read back
// with `decodeActionValue`, which refuses anything that does not fit the action's schema.
import { z } from "zod";

/** The roles a button can need. "platform_admin" is the platform administrator; the rest are the roles in a workspace. */
export const SLACK_ROLES = ["platform_admin", "owner", "admin", "member"] as const;
export type SlackRole = (typeof SLACK_ROLES)[number];

/** A concept's id: the slug the app gives it (src/lib/format.ts, slugify). */
export const conceptIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "not a concept id");
/** A row's id. */
export const itemIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** A person's id in the sign-in system. */
export const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "not a user id");
/** An access request's id. */
export const requestIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const requestValue = z.object({ requestId: requestIdSchema });
const userValue = z.object({ userId: userIdSchema });
const itemValue = z.object({ conceptId: conceptIdSchema, itemId: itemIdSchema });

type Style = "primary" | "danger";

/** A button that carries a value Slack sends back unchanged. */
const action = <V extends z.ZodObject>(label: string, role: SlackRole, value: V, style?: Style) => ({ kind: "action" as const, label, role, value, style });
/** A button that opens a page of the app; the address is part of the message, so no value is carried. */
const link = (label: string, role: SlackRole) => ({ kind: "link" as const, label, role, value: null, style: undefined });

/** Every button, by key. Keys are stable: they are stored in Slack messages already sent. */
export const ACTIONS = {
  // platform channel (section 2): the linked platform administrator only
  "platform.access_request.approve": action("Approve and invite", "platform_admin", requestValue, "primary"),
  "platform.access_request.decline": action("Decline", "platform_admin", requestValue, "danger"),
  "platform.signup.confirm": action("Confirm", "platform_admin", userValue, "primary"),
  "platform.signup.disable": action("Disable", "platform_admin", userValue, "danger"),
  "platform.user.disable": action("Disable user", "platform_admin", userValue, "danger"),
  "platform.open": link("Open", "platform_admin"),
  "platform.open_stripe": link("Open in Stripe", "platform_admin"),
  "platform.open_admin_email": link("Open Admin, Email", "platform_admin"),
  // workspace channels (section 3): checked against the person's role in that workspace
  "workspace.decision.yes": action("Decide: Yes", "member", itemValue, "primary"),
  "workspace.decision.no": action("Decide: No", "member", itemValue),
  "workspace.question.mark_decided": action("Mark decided", "member", itemValue),
  "workspace.review.draft_reply": action("Draft a reply", "member", itemValue),
  "workspace.open": link("Open", "member"),
  "workspace.open_status": link("Open status", "member"),
  "workspace.open_requirement": link("Open requirement", "member"),
  "workspace.open_claim": link("Open claim", "member"),
  "workspace.open_part": link("Open part", "member"),
  "workspace.open_economics": link("Open economics", "member"),
  "workspace.open_print_job": link("Open print job", "member"),
  "workspace.open_members": link("Open members", "member"),
  "workspace.review_drafts": link("Review drafts", "member"),
} as const;

export type ActionKey = keyof typeof ACTIONS;
export const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[];

/** The keys of the buttons that carry a value. */
export type ValueActionKey = { [K in ActionKey]: (typeof ACTIONS)[K]["kind"] extends "action" ? K : never }[ActionKey];

/** What the button `K` carries, as the server reads it back. */
export type ActionValue<K extends ValueActionKey> = z.infer<(typeof ACTIONS)[K]["value"]>;

/** Version of the value layout. A value with another version is refused, so a layout can change safely. */
const VERSION = "1";
const SEPARATOR = ":";

const fieldNames = (shape: z.ZodObject): string[] => Object.keys(shape.shape);
const isNumberField = (shape: z.ZodObject, name: string): boolean => shape.shape[name] instanceof z.ZodNumber;

/**
 * The value text for a button: the version, then each field in schema order, each percent-encoded and joined with
 * ":" ("1:baggage-claims:42"). Throws when the value does not fit the action's schema, so a bad value is never sent.
 */
export function encodeActionValue<K extends ValueActionKey>(key: K, value: ActionValue<K>): string {
  const schema = ACTIONS[key].value as z.ZodObject;
  const checked = schema.parse(value) as Record<string, string | number>;
  const text = [VERSION, ...fieldNames(schema).map((f) => encodeURIComponent(String(checked[f])))].join(SEPARATOR);
  return text;
}

/** The result of reading a value back. */
export type Decoded<K extends ValueActionKey> = { ok: true; value: ActionValue<K> } | { ok: false; reason: string };

/**
 * Reads a button's value back. Returns a reason instead of throwing, because the text came from outside: a wrong
 * version, a wrong number of fields, a field that is not a number where one is needed, or one the schema refuses.
 */
export function decodeActionValue<K extends ValueActionKey>(key: K, text: unknown): Decoded<K> {
  const schema = ACTIONS[key].value as z.ZodObject;
  if (typeof text !== "string" || text.length === 0 || text.length > 2000) return { ok: false, reason: "no value" };
  const [version, ...fields] = text.split(SEPARATOR);
  if (version !== VERSION) return { ok: false, reason: "unknown value version" };
  const names = fieldNames(schema);
  if (fields.length !== names.length) return { ok: false, reason: "wrong number of fields" };
  const raw: Record<string, string | number> = {};
  for (const [i, name] of names.entries()) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(fields[i] ?? "");
    } catch {
      return { ok: false, reason: `field ${name} is not encoded correctly` };
    }
    if (isNumberField(schema, name)) {
      if (!/^[1-9]\d{0,15}$/.test(decoded)) return { ok: false, reason: `field ${name} is not a number` };
      raw[name] = Number(decoded);
    } else {
      raw[name] = decoded;
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: `field ${String(parsed.error.issues[0]?.path[0] ?? "value")} is not valid` };
  return { ok: true, value: parsed.data as ActionValue<K> };
}

/** True when the key names a button that carries a value. */
export const carriesValue = (key: ActionKey): key is ValueActionKey => ACTIONS[key].kind === "action";
