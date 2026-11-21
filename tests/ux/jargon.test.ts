// U25 and U15: the words a person reads (gate checks, to-dos, hints, empty states) are task words. No field
// names (data.opening), store paths, "keys of the steps", or "the key 'go'" in strings shown on screen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

/** String literals and JSX text, without comments. Rough, but enough to catch a field name in copy. */
function shownText(src: string) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const strings = [...noComments.matchAll(/"([^"\n]{12,})"|`([^`]{12,})`/g)].map((m) => m[1] ?? m[2]);
  const jsx = [...noComments.matchAll(/>([^<>{}\n]{12,})</g)].map((m) => m[1]);
  // Keep what reads as words, not code that happens to sit between two quotes.
  return [...strings, ...jsx].filter((t) => / [a-z]/i.test(t) && !/=>|!==|===|&&|\|\||\.join\(|;\s*$|^\s*;|\bconst\b|\breturn\b/.test(t));
}

const BANNED: [RegExp, string][] = [
  [/\bdata\.(opening|mountingHoles|key|after|unlocks)\b/, "a data field name"],
  [/stage\/section keys/, "store keys"],
  [/Keys of the steps/i, "step keys"],
  [/none has the key/i, "the go decision's key"],
  [/the key "\$\{/, "a key"],
];

describe("copy is in task words", () => {
  it("no field names, keys or store paths in text on screen", () => {
    const offenders: string[] = [];
    for (const f of [...files("src/components"), ...files("src/lib/enclosure")]) {
      if (f.includes("ai-elements")) continue;
      for (const t of shownText(readFileSync(f, "utf8"))) for (const [re, what] of BANNED) if (re.test(t)) offenders.push(`${f}: ${what}: ${t.slice(0, 90)}`);
    }
    expect(offenders).toEqual([]);
  });
});
