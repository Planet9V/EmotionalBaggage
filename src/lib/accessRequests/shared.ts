/**
 * Access requests from the public welcome page: the form's schema, shared by the browser (react-hook-form)
 * and the open API route, so both refuse the same input with the same sentence. Nothing here touches the
 * database, so the browser can import it.
 */
import { z } from "zod";

export const ACCESS_STATUSES = ["new", "contacted", "declined"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];
export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = { new: "New", contacted: "Contacted", declined: "Declined" };

/**
 * The plans a request can name, by key: the plan catalogue's two tiers (src/lib/admin/planSchema.ts, built-in
 * catalogue; tests/api/access-requests.test.ts holds the two lists together). "" is "no plan chosen".
 * Owner, 22 Nov: "nothing free"; "no you cannot run it yourself, remove it": Free and Self-hosted are gone. Requests
 * stored before that may still carry "free" or "self" (migration 0030 allows them); Admin names them with
 * STORED_LEVEL_LABEL.
 */
export const ACCESS_LEVELS = ["maker", "studio"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = { maker: "Maker", studio: "Studio" };
/** A level as stored: the current plans, and the two retired ones older requests may carry. */
export type StoredLevel = AccessLevel | "free" | "self";
export const STORED_LEVEL_LABEL: Record<StoredLevel, string> = { ...ACCESS_LEVEL_LABEL, free: "Free (retired)", self: "Self-hosted (retired)" };

export const ACCESS_LIMITS = { name: 120, email: 254, building: 2000, company: 160 } as const;
/** The early-access one-liner is short: one line, not a brief. */
export const MAKING_MAX = 300;

/** Where on the welcome page the early-access form was sent from (migration 0041). "page": /welcome/early itself;
 *  "signup": the sign-up page while self sign-up is closed (a request for an account, migration 0044). */
const PLACEMENTS = ["hero", "pricing", "close", "page", "signup"] as const;
export type Placement = (typeof PLACEMENTS)[number];

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(ACCESS_LIMITS.email, "That email address is too long.")
  .pipe(z.email("That does not look like an email address."));
const name = z.string().trim().max(ACCESS_LIMITS.name, `Keep your name under ${ACCESS_LIMITS.name} characters.`);
const company = z.string().trim().max(ACCESS_LIMITS.company, `Keep the company name under ${ACCESS_LIMITS.company} characters.`);
const level = z.enum(["", ...ACCESS_LEVELS], "Choose Maker, Studio or not sure yet.");

/**
 * The early-access request (the form on /welcome, and the older full form, which sends the same fields): only the
 * email and "What do you want to make?" are required. `website` is a honeypot: the field is hidden from people (off
 * screen, out of the tab order, labelled "leave this empty"), so a value in it came from a script filling every box.
 * The server answers such a request as if it were taken and stores nothing. `visit` is the page's anonymous visit
 * id (src/components/welcome/early/track.tsx), sent by script only, so the sent form is counted in the funnel.
 */
export const AccessRequestForm = z.object({
  email,
  building: z.string().trim().min(3, "Say in a few words what you want to make.").max(ACCESS_LIMITS.building, `Keep this under ${ACCESS_LIMITS.building} characters.`),
  name: name.optional().default(""),
  company: company.optional().default(""),
  // Optional, so a page loaded before the field existed can still send its form; a value that is sent must be a known plan.
  level: level.optional().default(""),
  placement: z.enum(["", ...PLACEMENTS]).optional().default(""),
  website: z.string().max(500).optional().default(""),
  visit: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/).optional().catch(undefined),
});
export type AccessRequestParsed = z.output<typeof AccessRequestForm>;

/** The confirmation step: the optional fields, tied to the request by the token its answer carried. */
export const AccessRequestDetails = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/, "This confirmation has expired. Send the form again."),
  name: name.optional().default(""),
  company: company.optional().default(""),
  level: level.optional().default(""),
});


/** What a request got: a place, a place on the waiting list, or (a repeat of an address already listed) "listed". */
export type EarlyAccessOutcome = { kind: "place"; place: number } | { kind: "waiting"; position: number } | { kind: "listed" };

/** The answer's sentence for each outcome, word for word as the page shows it. */
export function outcomeMessage(o: EarlyAccessOutcome): string {
  switch (o.kind) {
    case "place":
      return `You have place number ${o.place}. We open workspaces in order and write to this address.`;
    case "waiting":
      return `Early access is full. You are number ${o.position} on the waiting list. We write to this address when a place opens.`;
    case "listed":
      return "You are on the list. We write to this address when your workspace opens.";
  }
}

/** The open route's answer. `token` comes only with a request just stored, for the optional details. */
export type AccessRequestAnswer = { ok: true; message: string; outcome: EarlyAccessOutcome; token?: string };

/** The count line above the form. */
export type EarlyAccessCount = { limit: number; held: number; left: number; waiting: number };

/** What a visitor may know of the count: places left, the limit, and whether it is full. Nothing else is public. */
export type PublicPlaces = { left: number; limit: number; full: boolean };

export const publicPlaces = (c: Pick<EarlyAccessCount, "left" | "limit">): PublicPlaces => ({ left: c.left, limit: c.limit, full: c.left === 0 });

/** The count line's sentence, word for word as the page shows it. */
export const countLine = (p: PublicPlaces): string => (p.full ? "Early access is full. Join the waiting list." : `${p.left} of ${p.limit} early-access places left`);

/** What the other forms on the page say once one of them has an answer, so nobody claims twice by mistake. */
export function claimedLine(o: EarlyAccessOutcome): string {
  switch (o.kind) {
    case "place":
      return `You have place number ${o.place}.`;
    case "waiting":
      return `You are number ${o.position} on the waiting list.`;
    case "listed":
      return "You are on the list.";
  }
}

export const ACTION_LABEL = { claim: "Claim an early-access place", wait: "Join the waiting list" } as const;

export type AccessRequestRow = {
  id: number;
  createdAt: string;
  name: string;
  email: string;
  building: string;
  company: string;
  /** "" when the visitor chose none, and for requests stored before the level was recorded */
  level: StoredLevel | "";
  /** the early-access place number; null when waiting */
  place: number | null;
  /** the position on the waiting list; null with a place, or when declined */
  waitingPosition: number | null;
  placement: Placement | "";
  status: AccessStatus;
  statusChangedAt: string | null;
};
