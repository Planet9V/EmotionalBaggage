import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The pages under docs/guide, in reading order. They are read at build time and served static. */
export const DOC_PAGES = [
  { slug: "user", title: "User guide", audience: "Anyone using the workbench", blurb: "The seven stages, what each screen does, and what is not built yet." },
  { slug: "admin", title: "Admin guide", audience: "Whoever installs and maintains it", blurb: "Install, settings, health, backups, updating." },
  { slug: "developer", title: "Developer guide", audience: "Whoever changes the code", blurb: "Stack, layout, data model, API rules, tests, common changes." },
  { slug: "system-context", title: "System context", audience: "Everyone", blurb: "The people who use it and the outside systems it touches, with a diagram." },
  { slug: "code-use", title: "Code use", audience: "Everyone", blurb: "Every third-party library, image, font and copied file, its licence and how it is used, with the draft attestation." },
] as const;

export type DocSlug = (typeof DOC_PAGES)[number]["slug"];

export const findDoc = (slug: string) => DOC_PAGES.find((d) => d.slug === slug);

export function readDoc(slug: DocSlug) {
  return readFileSync(join(process.cwd(), "docs", "guide", `${slug}.md`), "utf8");
}
