// A label belongs on an element whose role allows one. A plain div, span or p (role generic) may not carry
// aria-label (axe aria-prohibited-attr), and a Skeleton is decorative. Loading placeholders are labelled
// through LoadingShape or LoadingBlocks in src/components/ui/states.tsx; this reads every component so a
// new placeholder with a bare label fails here, before the browser suite.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

/** The opening tag starting at `i`, read up to its closing ">" outside braces and quotes. */
function openingTag(src: string, i: number): string {
  let depth = 0;
  let quote = "";
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || c === "`") {
      if (depth === 0) quote = c;
    } else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

export function bareLabels(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/<(div|span|p|Skeleton)[\s>]/g)) {
    const tag = openingTag(src, m.index);
    if (!/\baria-label(ledby)?=/.test(tag)) continue;
    if (m[1] !== "Skeleton" && /\brole=/.test(tag)) continue;
    out.push(tag.replace(/\s+/g, " ").slice(0, 140));
  }
  return out;
}

describe("loading placeholders and other generic elements carry no bare label", () => {
  it("the reader itself finds a bare label and passes a labelled region", () => {
    expect(bareLabels('<div className="x" aria-label="Loading">')).toHaveLength(1);
    expect(bareLabels('<Skeleton aria-label={`Counting ${n}`} />')).toHaveLength(1);
    expect(bareLabels('<div role="status" aria-label="Loading" onClick={() => a > b}>')).toHaveLength(0);
    expect(bareLabels('<ul aria-label="Parts">')).toHaveLength(0);
  });

  it("no component in src has one", () => {
    const found = files(join(ROOT, "src")).flatMap((f) => bareLabels(readFileSync(f, "utf8")).map((t) => `${relative(ROOT, f)}: ${t}`));
    expect(found).toEqual([]);
  });
});
