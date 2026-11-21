import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The pages shown under Documentation, in reading order. They are read at build time and served static. */
export const DOC_PAGES = [
  { slug: "user", title: "User guide", audience: "Anyone using the workbench", blurb: "The seven stages, what each screen does, and what is not built yet." },
  { slug: "admin", title: "Admin guide", audience: "Whoever installs and maintains it", blurb: "Install, settings, health, backups, updating." },
  { slug: "developer", title: "Developer guide", audience: "Whoever changes the code", blurb: "Stack, layout, data model, API rules, tests, common changes." },
  { slug: "system-context", title: "System context", audience: "Everyone", blurb: "The people who use it and the outside systems it touches, with a diagram." },
  { slug: "database", dir: "design", title: "Database design", audience: "Whoever changes the code", blurb: "The tables, the rules the database enforces itself, migrations, and the tables still to come." },
  { slug: "wiring", dir: "design", title: "Wiring model", audience: "Whoever changes the code", blurb: "Part kinds, pins, wires, nets, electrical checks, wire routing and the three schematic views." },
  { slug: "vector-search", dir: "design", title: "Vector search", audience: "Whoever changes the code or tunes the database", blurb: "PostgreSQL 19 and pgvector at 4,096 numbers per vector: what the limits are, the settings chosen, and the measurements behind them." },
  { slug: "visual-system", dir: "design", title: "Visual system", audience: "Whoever changes the code", blurb: "Foundations, the frame, four page patterns, six states, diagrams and 3D." },
  { slug: "code-use", title: "Code use", audience: "Everyone", blurb: "Every third-party library, image, font and copied file, its licence and how it is used, with the attestation." },
] as const;

export type DocSlug = (typeof DOC_PAGES)[number]["slug"];

export const findDoc = (slug: string) => DOC_PAGES.find((d) => d.slug === slug);

/** Guides live in docs/guide; design decisions in docs/design. */
export function readDoc(slug: DocSlug) {
  const page = DOC_PAGES.find((d) => d.slug === slug);
  const dir = page && "dir" in page ? page.dir : "guide";
  return readFileSync(join(process.cwd(), "docs", dir, `${slug}.md`), "utf8");
}
