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
 * The service levels a request can name, by key. The welcome page's cards (LEVELS in
 * src/components/welcome/content.ts) use the same keys and names; tests/api/access-requests.test.ts holds the two
 * lists together, and migration 0045 holds the column to these keys. "" is "no level chosen".
 */
export const ACCESS_LEVELS = ["free", "maker", "studio", "self"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = { free: "Free", maker: "Maker", studio: "Studio", self: "Self-hosted" };
export const isAccessLevel = (v: unknown): v is AccessLevel => (ACCESS_LEVELS as readonly unknown[]).includes(v);

export const ACCESS_LIMITS = { name: 120, email: 254, building: 2000, company: 160 } as const;

/**
 * The form. `website` is a honeypot: the field is hidden from people (off screen, out of the tab order,
 * labelled "leave this empty"), so a value in it came from a script filling every box. The server answers
 * such a request as if it were stored and stores nothing.
 */
export const AccessRequestForm = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(ACCESS_LIMITS.name, `Keep your name under ${ACCESS_LIMITS.name} characters.`),
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address so the owner can reply.")
    .max(ACCESS_LIMITS.email, "That email address is too long.")
    .pipe(z.email("That does not look like an email address.")),
  building: z
    .string()
    .trim()
    .min(10, "Say in a sentence or two what you want to build.")
    .max(ACCESS_LIMITS.building, `Keep this under ${ACCESS_LIMITS.building} characters.`),
  company: z.string().trim().max(ACCESS_LIMITS.company, `Keep the company name under ${ACCESS_LIMITS.company} characters.`),
  // Optional, so a page loaded before the field existed can still send its form; a value that is sent must be a known level.
  level: z.enum(["", ...ACCESS_LEVELS], "Choose one of the listed levels.").optional(),
  website: z.string().max(500),
});
export type AccessRequestValues = z.infer<typeof AccessRequestForm>;

/** What the server answers when a request is taken. The words are the page's confirmation, word for word. */
export const ACCESS_CONFIRMATION = "We have your request. Nothing is sent by email yet; the owner sees it in Admin.";

export type AccessRequestRow = {
  id: number;
  createdAt: string;
  name: string;
  email: string;
  building: string;
  company: string;
  /** "" when the visitor chose none, and for requests stored before the level was recorded */
  level: AccessLevel | "";
  status: AccessStatus;
  statusChangedAt: string | null;
};
