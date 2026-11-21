// Which rows link to which, by key. One definition for the server's checks and the screens.
import { STORE } from "@/lib/domain/schemas";
import { keys } from "@/lib/domain/step";

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
  // The other end of the requirement links: a drafted test or part names the requirements it serves.
  // Either end may be written; src/lib/trace/mirror.ts keeps the other end the same.
  [STORE.tests]: {
    requirements: { section: STORE.requirements, noun: "requirement", where: "Design, Requirements" },
  },
  [STORE.parts]: {
    requirements: { section: STORE.requirements, noun: "requirement", where: "Design, Requirements" },
  },
};

/**
 * The links kept at both ends: a requirement's `tests` (or `parts`) list and the test's (or part's)
 * `requirements` list say the same thing. One table, read by the coverage and by the mirror.
 */
export const MIRRORED: { field: "tests" | "parts"; section: string }[] = [
  { field: "tests", section: STORE.tests },
  { field: "parts", section: STORE.parts },
];

/** A test counts as done only when it passed. */
export const TEST_DONE = "pass";

export const keyOf = (data: Record<string, unknown> | undefined): string => (typeof data?.key === "string" ? data.key.trim() : "");

/** A list of keys stored in a row's data (the one reader is `keys` in lib/domain/step.ts). */
export const listOf = (data: Record<string, unknown> | undefined, field: string): string[] => keys(data?.[field]);
