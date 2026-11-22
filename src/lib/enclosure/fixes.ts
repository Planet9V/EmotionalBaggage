// Where each thing that blocks the Enclosure page is fixed: the page, and the control or row on it. A link is
// `/s/<stage>/<section>`, then `#<id>` for a control (the page scrolls to it and focuses it, see DeepLinkFocus)
// or `?item=<id>` for a row. Pure, so the page and the tests agree on the addresses.
import { NUMERIC_RULES, type Issue, type SpecPart } from "./types";

export type Fix = { href: string; label: string };

export const ENCLOSURE_HREF = "/s/design/enclosure";
export const LAYOUT_HREF = "/s/design/layout";
/** The ids of the controls on the Enclosure page that a blocking message can point at. */
export const GENERATOR_ANCHOR = "enclosure-generator";
export const GENERATE_ANCHOR = "enclosure-generate";
export const PART_PICK_ANCHOR = "enclosure-part-pick";
export const PARAMETERS_ANCHOR = "enclosure-parameters";

const OPENING_CODES = ["crossing-no-opening", "opening-outside-wall", "openings-overlap"];

/** The row of the part a message is about: its reference or its title, as the checks name it. */
const partNamed = (parts: SpecPart[], about: string | undefined) => parts.find((p) => (p.ref || p.title) === about);

/** The fix for one blocking message: a parameter field, a part's opening here, or the part's row in Physical layout. */
export function fixFor(issue: Issue, parts: SpecPart[]): Fix {
  if (issue.code === "param-range") {
    const rule = NUMERIC_RULES.find((r) => r.key === issue.about);
    return rule ? { href: `${ENCLOSURE_HREF}#enc-${rule.key}`, label: `Change ${rule.label.toLowerCase()}` } : { href: `${ENCLOSURE_HREF}#${PARAMETERS_ANCHOR}`, label: "Change the parameters" };
  }
  if (issue.code === "no-parts") return { href: LAYOUT_HREF, label: "Open Physical layout" };
  if (OPENING_CODES.includes(issue.code)) return { href: `${ENCLOSURE_HREF}#${PART_PICK_ANCHOR}`, label: "Change the part's opening" };
  const part = partNamed(parts, issue.about);
  return part ? { href: `${LAYOUT_HREF}?item=${part.id}`, label: `Move ${part.ref || part.title} in Physical layout` } : { href: LAYOUT_HREF, label: "Open Physical layout" };
}

/** When no part has a box: the first part row to give one, or the layout itself when there are no parts. */
export function noBoxFix(rows: { id: number; data: unknown }[]): Fix {
  const first = rows.find((r) => !(r.data as { geometry?: unknown } | null)?.geometry);
  return first ? { href: `${LAYOUT_HREF}?item=${first.id}`, label: "Give a part a size and place in Physical layout" } : { href: LAYOUT_HREF, label: "Open Physical layout" };
}
