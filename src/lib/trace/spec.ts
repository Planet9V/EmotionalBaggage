// Which rows link to which, by key. One definition for the server's checks and the screens.
import { STORE } from "@/lib/domain/schemas";

export type LinkField = {
  /** the section the keys must name */
  section: string;
  /** one target, in words: "acceptance test" */
  noun: string;
  /** where the user finds those rows */
  where: string;
};

/** section of the row that holds the list -> field name -> what the list points at */
export const LINK_FIELDS: Record<string, Record<string, LinkField>> = {
  [STORE.requirements]: {
    tests: { section: STORE.tests, noun: "acceptance test", where: "Prototype, Acceptance tests" },
    parts: { section: STORE.parts, noun: "part", where: "Design, Bill of materials" },
  },
  [STORE.builds]: {
    tests: { section: STORE.tests, noun: "acceptance test", where: "Prototype, Acceptance tests" },
  },
};

/** A test counts as done only when it passed. */
export const TEST_DONE = "pass";

export const keyOf = (data: Record<string, unknown> | undefined): string => (typeof data?.key === "string" ? data.key.trim() : "");

export function listOf(data: Record<string, unknown> | undefined, field: string): string[] {
  const v = data?.[field];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
