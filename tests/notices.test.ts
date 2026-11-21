import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CODE_USE_PATH, NOTICES_PATH, USES, checkNotices, readManual } from "../scripts/notices.mjs";

type ManualEntry = { name?: string; version?: string; license?: string; use?: string; source?: string; referencedIn?: string[] };
type Manual = { entries: ManualEntry[]; unknownLicences?: Record<string, string> };
type Pkg = { id: string; name: string; license: string };
type PyPkg = { name: string; license: string };

const codeUse = () => readFileSync(CODE_USE_PATH, "utf8");

describe("third-party notices", () => {
  it("are current: regenerating them gives the files on disk", async () => {
    const { problems, warnings, pythonAvailable } = await checkNotices();
    if (!pythonAvailable) console.warn(`Python section not checked: ${warnings.join("; ")}`);
    expect(problems).toEqual([]);
  }, 60_000);

  it("name every production dependency of package.json on the code-use page", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const page = codeUse();
    const missing = Object.keys(pkg.dependencies).filter((name) => !page.includes(`| ${name} |`));
    expect(missing).toEqual([]);
  });

  it("name every package of planner/requirements.txt on the code-use page and in the notices", () => {
    const reqs = readFileSync("planner/requirements.txt", "utf8")
      .split("\n")
      .map((l) => l.split("#")[0].trim())
      .filter(Boolean)
      .map((l) => l.split(/[\[=<>~!; ]/)[0]);
    expect(reqs.length).toBeGreaterThan(0);
    const page = codeUse().toLowerCase();
    const notices = readFileSync(NOTICES_PATH, "utf8").toLowerCase();
    expect(reqs.filter((r) => !page.includes(`| ${r.toLowerCase()} |`))).toEqual([]);
    expect(reqs.filter((r) => !notices.includes(`| ${r.toLowerCase()}`))).toEqual([]);
  });

  it("have no UNKNOWN licence without an explanation in the manual file", async () => {
    const manual = readManual() as Manual;
    const explained = manual.unknownLicences ?? {};
    const { built } = await checkNotices();
    const npm = (built.data.npm.packages as Pkg[]).filter((p) => /UNKNOWN|UNLICENSED/i.test(p.license));
    const py = built.pythonAvailable ? (built.data.py.packages as PyPkg[]).filter((p) => /UNKNOWN/i.test(p.license)) : [];
    const unexplained = [...npm.map((p) => p.name), ...py.map((p) => p.name)].filter((name) => !explained[name]);
    expect(unexplained).toEqual([]);
  }, 60_000);

  it("give every manual entry a name, version, licence, use, source and the file that references it", () => {
    const manual = readManual() as Manual;
    expect(manual.entries.length).toBeGreaterThan(0);
    for (const e of manual.entries) {
      expect(e.name, JSON.stringify(e)).toBeTruthy();
      expect(e.version, e.name).toBeTruthy();
      expect(e.license, e.name).toBeTruthy();
      expect(USES, e.name).toContain(e.use);
      expect(e.source, e.name).toMatch(/^https:\/\//);
      expect(e.referencedIn?.length, e.name).toBeGreaterThan(0);
      for (const f of e.referencedIn ?? []) expect(() => readFileSync(f), `${e.name}: ${f}`).not.toThrow();
    }
  });

  it("end the code-use page with the attestation, its wording approved by the owner", () => {
    const page = codeUse();
    const attestation = page.slice(page.indexOf("## Attestation"));
    expect(attestation).toContain("I attest that:");
    expect(attestation).toContain("Wording approved: Jim McKenney, 20 November 2026");
    expect(attestation).not.toMatch(/draft/i);
  });
});
