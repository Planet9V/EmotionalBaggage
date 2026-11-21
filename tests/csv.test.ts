// Robustness review S7: the parts list and the wiring list only quoted CSV cells; a cell starting with
// = + - @ (or a tab or carriage return) reached the spreadsheet as a formula. There is now one CSV writer.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toCsvText } from "@/lib/csv";
import { toCsv } from "@/components/parts/bom";
import { wiringCsv } from "@/components/schematic/model";
import type { Part, Wire } from "@/lib/domain";

const EVIL = ["=HYPERLINK(\"http://evil.example\",\"x\")", "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1", "=cmd|' /C calc'!A0\nsecond line"];

describe("toCsvText", () => {
  it("neutralises every formula start, including one followed by a line break", () => {
    for (const v of EVIL) expect(toCsvText([[v]], { trailingNewline: false }).replace(/^"/, "")).toMatch(/^'/);
    // papaparse also quotes a neutralised cell, as OWASP's CSV injection guidance suggests
    expect(toCsvText([["=1+1"]], { trailingNewline: false })).toBe("\"'=1+1\"");
    expect(toCsvText([["=a\nb"]], { trailingNewline: false })).toBe("\"'=a\nb\"");
  });

  it("quotes per RFC 4180 and leaves numbers and plain text alone", () => {
    expect(toCsvText([["a", 'say "hi", ok', -3, null], ["b", 2.5, true, undefined]])).toBe('a,"say ""hi"", ok",-3,\r\nb,2.5,true,\r\n');
  });
});

describe("the exports use it", () => {
  it("the reviewer's repro: the parts list neutralises a formula in a reference, title or spec", () => {
    const part = { ref: "=1+2", item: { id: 1, title: "@SUM(A1)", body: "+cmd", status: "planned" }, qty: 2, source: "-x", search: "", line: null } as unknown as Part;
    const out = toCsv([part]);
    const row = out.split("\r\n")[1];
    expect(row).toBe(`"'=1+2","'@SUM(A1)","'+cmd",2,"'-x",,`);
  });

  it("the wiring list neutralises a formula in a wire's name or note", () => {
    const w = { order: 1, name: "=evil()", net: "VCC", netClass: "", from: "U1", fromPin: "1", to: "J1", toPin: "2", via: "", note: "@x", status: "to solder", item: { id: 1 } } as unknown as Wire;
    const row = wiringCsv([w]).split("\r\n")[1];
    expect(row).toBe(`1,"'=evil()",VCC,,U1,1,J1,2,,"'@x",to solder`);
  });

  it("no other source file writes CSV by hand", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const f = join(dir, n);
        if (statSync(f).isDirectory()) walk(f);
        else if (/\.(ts|tsx)$/.test(n) && !f.endsWith(join("lib", "csv.ts"))) {
          const t = readFileSync(f, "utf8");
          if (/Papa\.unparse|replace\(\/"\/g, '""'\)/.test(t)) hits.push(f);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});
