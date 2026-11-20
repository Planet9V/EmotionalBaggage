#!/usr/bin/env node
/**
 * Third-party notices: one generated record of the code this application uses.
 *
 *   npm run notices          writes THIRD_PARTY_NOTICES.md and docs/guide/code-use.md
 *   npm run notices:check    regenerates in memory; exits 1 naming the first difference
 *
 * Sources, all read from this machine, never typed by hand:
 *  - package-lock.json: which npm packages are in the production tree (entries not marked dev).
 *  - license-checker-rseidelsohn: licence, repository and licence file of each installed package.
 *  - scripts/notices_python.py: the planner's Python packages from importlib.metadata.
 *  - docs/third-party.manual.json: what no package manager knows about (images, fonts, copied source).
 *
 * Platform-specific builds (lock entries with os, cpu or libc, such as @img/sharp-* and
 * @next/swc-*) are listed from package-lock.json for every platform, with the lock's licence and
 * the npm page as link, so the output is the same on Linux and macOS. Licence texts are taken only
 * from packages installed on every platform.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const NOTICES_PATH = "THIRD_PARTY_NOTICES.md";
export const CODE_USE_PATH = "docs/guide/code-use.md";
export const MANUAL_PATH = "docs/third-party.manual.json";
export const USES = ["container image", "separate process", "font files", "copied source", "linked library"];
/** The one line allowed to differ between runs; the check ignores it. */
export const GENERATED_LINE = /^Generated from package-lock\.json at commit .*$/m;
const PY_START = "[//]: # (python:start)";
const PY_END = "[//]: # (python:end)";

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byName = (a, b) => cmp(a.name.toLowerCase(), b.name.toLowerCase()) || cmp(a.name, b.name);
const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const row = (cells) => `| ${cells.map(cell).join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const fence = (text) => {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const f = "`".repeat(longest + 1);
  return `${f}text\n${text.replace(/\s+$/, "")}\n${f}`;
};
/** Split an SPDX-like expression into its identifiers. */
export const identifiers = (expr) =>
  String(expr)
    .replace(/[()]/g, " ")
    .split(/\s+(?:AND|OR|WITH)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

function runLicenseChecker(root) {
  const checker = require("license-checker-rseidelsohn");
  return new Promise((resolve, reject) => {
    checker.init({ start: root, excludePrivatePackages: true }, (err, packages) => (err ? reject(err) : resolve(packages)));
  });
}

function shortHash(root) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/** The npm production tree from package-lock.json, with licence data from license-checker. */
async function collectNpm(root) {
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const checked = await runLicenseChecker(root);
  const byId = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    const name = entry.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    const id = `${name}@${entry.version}`;
    const platform = Boolean(entry.os || entry.cpu || entry.libc);
    const installed = existsSync(join(root, path));
    const prev = byId.get(id);
    const dev = Boolean(entry.dev);
    if (prev) {
      prev.dev = prev.dev && dev;
      continue;
    }
    byId.set(id, { id, name, version: entry.version, lockLicense: entry.license, platform, installed, dev, path });
  }

  const problems = [];
  const packages = [];
  for (const p of byId.values()) {
    const info = checked[p.id];
    if (!p.platform && !p.installed && !p.dev) problems.push(`${p.id} is in package-lock.json but not installed; run npm ci`);
    let license;
    let guessed = false;
    let repository;
    let licenseFile = null;
    if (p.platform || !info) {
      license = p.lockLicense ?? (info?.licenses ? String(info.licenses) : "UNKNOWN");
      repository = `https://www.npmjs.com/package/${p.name}`;
    } else {
      const raw = Array.isArray(info.licenses) ? info.licenses.join(" OR ") : String(info.licenses ?? "UNKNOWN");
      guessed = raw.endsWith("*");
      license = raw.replace(/\*$/, "");
      repository = info.repository || `https://www.npmjs.com/package/${p.name}`;
      licenseFile = info.licenseFile ?? null;
      if (p.lockLicense && p.lockLicense !== license && !guessed) {
        problems.push(`${p.id}: package-lock.json says ${p.lockLicense}, the installed package says ${license}`);
      }
    }
    packages.push({ ...p, license, guessed, repository, licenseFile });
  }
  packages.sort((a, b) => cmp(a.name, b.name) || cmp(a.version, b.version));

  const top = (name) => lock.packages[`node_modules/${name}`];
  const findPkg = (name) => packages.find((p) => p.name === name && p.version === top(name)?.version);
  const direct = Object.keys(pkg.dependencies ?? {}).sort(cmp).map((name) => ({ name, range: pkg.dependencies[name], pkg: findPkg(name) }));
  const directDev = Object.keys(pkg.devDependencies ?? {}).sort(cmp).map((name) => ({ name, range: pkg.devDependencies[name], pkg: findPkg(name) }));
  return { packages, production: packages.filter((p) => !p.dev), direct, directDev, problems, root: pkg };
}

/** The planner's Python packages, or the reason they could not be read. */
function collectPython(root) {
  const python = process.env.PYTHON || "python3";
  const res = spawnSync(python, [join(root, "scripts", "notices_python.py"), join(root, "planner", "requirements.txt")], { encoding: "utf8" });
  if (res.error) return { error: `${python} could not be run: ${res.error.message}` };
  if (res.status !== 0) return { error: `${python} scripts/notices_python.py exited ${res.status}: ${res.stderr.trim()}` };
  const data = JSON.parse(res.stdout);
  const requirements = readFileSync(join(root, "planner", "requirements.txt"), "utf8")
    .split("\n")
    .map((l) => l.split("#")[0].trim())
    .filter(Boolean);
  return { ...data, requirements };
}

export function readManual(root = ROOT) {
  return JSON.parse(readFileSync(join(root, MANUAL_PATH), "utf8"));
}

/** Which direct dependencies are imported somewhere under src/ (or the root config files). */
function importedSet(root, names) {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs|css)$/.test(f)) files.push(full);
    }
  };
  walk(join(root, "src"));
  for (const f of ["next.config.ts", "tailwind.config.ts", "postcss.config.mjs"]) if (existsSync(join(root, f))) files.push(join(root, f));
  const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new Set(names.filter((n) => new RegExp(`(?:from|import|require\\(|import\\()\\s*["']${esc(n)}(?:/[^"']*)?["']`).test(text)));
}

/**
 * A phrase each licence's own text contains, so a file is only used as a licence's text when it
 * really holds that text (a dual-licensed package's file often holds only one of the two).
 */
const SIGNATURES = {
  "0BSD": /Permission to use, copy, modify, and\/or distribute this software/i,
  "Apache-2.0": /Apache License\s+Version 2\.0/i,
  "BlueOak-1.0.0": /Blue Oak Model License/i,
  "BSD-2-Clause": /Redistribution and use in source and binary forms/i,
  "BSD-3-Clause": /Redistribution and use in source and binary forms/i,
  "CC-BY-4.0": /Attribution 4\.0 International/i,
  "CC0-1.0": /CC0 1\.0 Universal/i,
  "EPL-2.0": /Eclipse Public License - v 2\.0/i,
  "GPL-3.0-or-later": /GNU GENERAL PUBLIC LICENSE\s+Version 3/i,
  ISC: /Permission to use, copy, modify, and\/or distribute this software/i,
  "LGPL-3.0-or-later": /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3/i,
  MIT: /Permission is hereby granted, free of charge/i,
  "MPL-2.0": /Mozilla Public License,? (?:Version|v\.) ?2\.0/i,
  "OFL-1.1": /SIL OPEN FONT LICENSE\s+Version 1\.1/i,
  Unlicense: /free and unencumbered software released into the public domain/i,
};

function licenceTexts(root, production) {
  const ids = [...new Set(production.flatMap((p) => identifiers(p.license)))].sort(cmp);
  const isLicenceFile = (f) => f && /^(licen[cs]e|copying)/i.test(basename(f));
  const holds = (p, id) => {
    const text = readFileSync(p.licenseFile, "utf8");
    return SIGNATURES[id] ? SIGNATURES[id].test(text) : p.license === id;
  };
  const out = [];
  for (const id of ids) {
    const carriers = production.filter((p) => identifiers(p.license).includes(id));
    const everywhere = carriers.filter((p) => !p.platform && isLicenceFile(p.licenseFile) && holds(p, id));
    const exact = everywhere.find((p) => p.license === id) ?? everywhere[0];
    const names = carriers.map((p) => p.id);
    if (exact) {
      const text = readFileSync(exact.licenseFile, "utf8");
      const covers = exact.license === id ? "" : ` (that file covers ${exact.license})`;
      out.push({ id, names, from: `${exact.id}, ${relative(join(root, exact.path), exact.licenseFile)}${covers}`, text });
    } else {
      out.push({ id, names, from: null, text: null });
    }
  }
  return out;
}

const summarise = (list) => {
  const m = new Map();
  for (const p of list) m.set(p.license, (m.get(p.license) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
};

const licenceLabel = (p) => (p.guessed ? `${p.license} (from its licence file; package.json declares none)` : p.license);

/** Build both documents. Returns { files: { path: content }, data, warnings }. */
export async function buildNotices(root = ROOT) {
  const npm = await collectNpm(root);
  const py = collectPython(root);
  const manual = readManual(root);
  const hash = shortHash(root);
  const generated = `Generated from package-lock.json at commit ${hash} by \`npm run notices\`; do not edit by hand.`;
  const uses = manual.useOverrides ?? {};
  const imported = importedSet(root, npm.direct.map((d) => d.name));
  const prodDirect = npm.production.filter((p) => npm.direct.some((d) => d.pkg?.id === p.id));
  const platformCount = npm.production.filter((p) => p.platform).length;
  const texts = licenceTexts(root, npm.production);
  const warnings = [...npm.problems];
  if (py.error) warnings.push(`Python packages not read: ${py.error}`);

  // ---------- THIRD_PARTY_NOTICES.md ----------
  const N = [];
  N.push("# Third-party notices", "");
  N.push(generated, "");
  N.push(
    "Every third-party component this repository uses: the npm packages of the web app's production dependency tree (direct and transitive), the Python packages the planner installs, and the material no package manager knows about (container images, fonts, copied source). The page shown in the app, with how each direct component is used and the attestation, is `docs/guide/code-use.md`.",
    "",
  );
  N.push("## npm packages (production tree)", "");
  N.push(
    `${npm.production.length} packages: ${prodDirect.length} direct, ${npm.production.length - prodDirect.length} transitive. ${platformCount} of them are platform-specific builds (marked "platform build"); npm installs only the ones matching the machine, and their licence is taken from package-lock.json and their link is the npm page. All other licences are read from the installed packages by license-checker-rseidelsohn.`,
    "",
  );
  N.push(
    table(
      ["Package", "Version", "Licence", "Repository", "Kind"],
      npm.production.map((p) => [p.name, p.version, licenceLabel(p), p.repository, [prodDirect.includes(p) ? "direct" : "transitive", p.platform ? "platform build" : ""].filter(Boolean).join(", ")]),
    ),
    "",
  );
  N.push("### Licence texts", "");
  N.push("Each licence identifier found above, with its text once, copied from the first package (in the order above) that ships it as a licence file and is installed on every platform. Copyright lines differ from package to package; each package's own licence file is in its published package.", "");
  for (const t of texts) {
    N.push(`#### ${t.id}`, "");
    N.push(`Used by: ${t.names.join(", ")}.`, "");
    if (t.text) {
      N.push(`Text from ${t.from}:`, "", fence(t.text), "");
    } else {
      N.push(`No package installed on every platform ships this licence's text in a licence file, so the text is not reproduced here. Reference text: https://spdx.org/licenses/${t.id}.html`, "");
    }
  }
  N.push(PY_START);
  N.push("## Python packages (planner)", "");
  if (py.error) {
    N.push(`Not generated: ${py.error}`, "");
  } else {
    N.push(
      `Read with importlib.metadata from Python ${py.python.split(".").slice(0, 2).join(".")} after \`pip install -r planner/requirements.txt\`: ${py.packages.length} packages, ${py.packages.filter((p) => p.direct).length} listed in requirements.txt and ${py.packages.filter((p) => !p.direct).length} pulled in by them. requirements.txt pins minor versions only, so the versions below are those installed where this file was generated. "(classifier)" means the package declares no licence identifier and the licence is its Trove classifier.`,
      "",
    );
    N.push(
      table(
        ["Package", "Version", "Licence", "Home page", "Required by"],
        py.packages.map((p) => [p.name + (p.extras.length ? `[${p.extras.join(",")}]` : ""), p.version, p.license, p.home, p.direct ? "planner/requirements.txt" : p.requiredBy.join(", ")]),
      ),
      "",
    );
  }
  N.push(PY_END, "");
  N.push("## Not from a package manager", "");
  N.push(`Listed by hand in \`${MANUAL_PATH}\`.`, "");
  for (const e of [...manual.entries].sort(byName)) {
    N.push(`### ${e.name}`, "");
    N.push(`- Version or tag: ${e.version}`);
    N.push(`- Licence: ${e.license}`);
    N.push(`- How it is used: ${e.use}`);
    if (e.origin) N.push(`- Origin: ${e.origin}`);
    if (e.changes) N.push(`- Changes: ${e.changes}`);
    N.push(`- Referenced in: ${e.referencedIn.map((f) => `\`${f}\``).join(", ")}`);
    N.push(`- Source: ${e.source}`);
    N.push(`- Licence evidence: ${e.licenseEvidence}`);
    if (e.notes) N.push(`- Notes: ${e.notes}`);
    N.push("");
  }
  const notices = N.join("\n").replace(/\n+$/, "\n");

  // ---------- docs/guide/code-use.md ----------
  const C = [];
  C.push("# Code use", "");
  C.push(generated, "");
  C.push("## What this page is", "");
  C.push(
    "A record of the third-party code and material this workbench uses, and how each piece is used. The library lists are generated from the installed dependencies, and a test fails when this page no longer matches them. Container images, fonts and copied source are listed by hand in `docs/third-party.manual.json`. The full list, including every transitive package and the licence texts, is in `THIRD_PARTY_NOTICES.md` at the root of the repository.",
    "",
  );
  C.push("How a component can be used here:", "");
  C.push("- **Linked library**: installed by npm or pip and loaded into the web app or the planner process, unmodified.");
  C.push("- **Separate process**: a program that runs on its own and is called over the network or the command line; it is not linked or copied into this code.");
  C.push("- **Container image**: a published image the Docker build or Compose file starts from or runs.");
  C.push("- **Font files**: font files served to the browser, unmodified.");
  C.push("- **Copied source**: source copied into this repository, listed with its origin and changes.", "");
  C.push("## Summary by licence", "");
  C.push(`Web app, npm production tree: ${npm.production.length} packages (${prodDirect.length} direct, ${npm.production.length - prodDirect.length} transitive, of which ${platformCount} are platform-specific builds).`, "");
  C.push(table(["Licence", "npm packages"], summarise(npm.production).map(([l, n]) => [l, n])), "");
  C.push(PY_START);
  if (py.error) {
    C.push(`Planner, Python packages: not generated (${py.error}).`, "");
  } else {
    C.push(`Planner, Python packages: ${py.packages.length} (${py.packages.filter((p) => p.direct).length} direct, ${py.packages.filter((p) => !p.direct).length} transitive).`, "");
    C.push(table(["Licence", "Python packages"], summarise(py.packages).map(([l, n]) => [l, n])), "");
  }
  C.push(PY_END, "");
  C.push("## Web app: direct dependencies", "");
  C.push('From `package.json` "dependencies", at the versions installed by package-lock.json. "Imported in src/" says whether a source file of this repository imports it at this version of the code; "no" can still mean it is loaded by another package (react-dom is loaded by next) or that it was added for a planned item.', "");
  C.push(
    table(
      ["Package", "Version", "Licence", "How it is used", "Imported in src/"],
      npm.direct.map((d) => [d.name, d.pkg?.version ?? "not installed", d.pkg ? licenceLabel(d.pkg) : "UNKNOWN", uses[d.name] ?? "linked library", imported.has(d.name) ? "yes" : "no"]),
    ),
    "",
  );
  C.push(PY_START);
  C.push("## Planner: direct dependencies", "");
  if (py.error) {
    C.push(`Not generated: ${py.error}`, "");
  } else {
    C.push("From `planner/requirements.txt`, at the versions installed where this page was generated.", "");
    C.push(
      table(
        ["Package", "Requirement", "Installed", "Licence", "How it is used"],
        py.packages.filter((p) => p.direct).map((p) => {
          const req = py.requirements.find((r) => r.toLowerCase().replace(/[_.]/g, "-").startsWith(p.name.toLowerCase().replace(/[_.]/g, "-"))) ?? p.name;
          return [p.name, req, p.version, p.license, "linked library"];
        }),
      ),
      "",
    );
  }
  C.push(PY_END, "");
  C.push("## Not from a package manager", "");
  C.push(
    table(
      ["Name", "Version or tag", "Licence", "How it is used", "Source"],
      [...manual.entries].sort(byName).map((e) => [e.name, e.version, e.license, e.use, e.source]),
    ),
    "",
  );
  for (const e of [...manual.entries].sort(byName).filter((x) => x.origin)) {
    C.push(`**${e.name}**: origin ${e.origin}. ${e.changes ?? ""}`.trim(), "");
  }
  C.push("The file that references each entry, and the evidence for its licence, are in `THIRD_PARTY_NOTICES.md`.", "");
  C.push("### Planned, not yet included", "");
  C.push(
    "OrcaSlicer, WireViz, OpenSCAD, CaseMaker and YAPP_Box are planned and are not in the repository yet. Each will be added to this page in the same change that introduces it: OrcaSlicer, WireViz and OpenSCAD run as separate processes, and CaseMaker and YAPP_Box as forked code with the changes listed.",
    "",
  );
  C.push("## Development-only tooling", "");
  C.push('From `package.json` "devDependencies": used to build, check and test the code; not part of the production dependency tree.', "");
  C.push(
    table(
      ["Package", "Version", "Licence"],
      npm.directDev.map((d) => [d.name, d.pkg?.version ?? "not installed", d.pkg ? licenceLabel(d.pkg) : "UNKNOWN"]),
    ),
    "",
  );
  C.push("## Attestation", "");
  C.push("The statement below is a draft, to be approved by the person who gave the legal sign-off before it is relied on.", "");
  C.push("> **Draft, awaiting approval.**");
  C.push(">");
  C.push("> I attest that:");
  C.push(">");
  C.push("> 1. The lists of npm and Python packages on this page and in `THIRD_PARTY_NOTICES.md` were generated from the dependencies installed for the commit stated at the top of this page.");
  C.push("> 2. Components marked \"linked library\" are used unmodified, under their own licences.");
  C.push("> 3. Components marked \"separate process\" are invoked as separate programs; they are not linked into or copied into this code.");
  C.push("> 4. Components marked \"container image\" are used as published, as the base of or alongside this application's containers.");
  C.push("> 5. Source copied or forked into this repository is listed above with its origin and the changes made to it.");
  C.push("> 6. This repository's own code is licensed as stated in its `LICENSE` file (Apache License, Version 2.0).");
  C.push(">");
  C.push("> Name: ______________________  Date: ______________");
  C.push("");
  C.push("## Full list", "");
  C.push("`THIRD_PARTY_NOTICES.md` at the root of the repository lists every package of the production tree, direct and transitive, with its version, licence and repository, the text of each licence once, and the evidence for each entry listed by hand.", "");
  const codeUse = C.join("\n").replace(/\n+$/, "\n");

  return {
    files: { [NOTICES_PATH]: notices, [CODE_USE_PATH]: codeUse },
    data: { npm, py, manual, texts },
    warnings,
    pythonAvailable: !py.error,
  };
}

/** Normalise for comparison: drop the generated line; drop the Python sections when Python could not be read. */
export function normalise(text, dropPython) {
  let t = text.replace(GENERATED_LINE, "Generated from package-lock.json at commit (ignored)");
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  if (dropPython) t = t.replace(new RegExp(`${esc(PY_START)}[\\s\\S]*?${esc(PY_END)}`, "g"), `${PY_START}\n(not checked)\n${PY_END}`);
  return t;
}

/** Compare the generated files with the ones on disk. Returns a list of problems (empty when current). */
export async function checkNotices(root = ROOT) {
  const built = await buildNotices(root);
  const problems = [];
  for (const [path, expected] of Object.entries(built.files)) {
    const full = join(root, path);
    if (!existsSync(full)) {
      problems.push(`${path} is missing; run npm run notices`);
      continue;
    }
    const want = normalise(expected, !built.pythonAvailable).split("\n");
    const have = normalise(readFileSync(full, "utf8"), !built.pythonAvailable).split("\n");
    const n = Math.max(want.length, have.length);
    for (let i = 0; i < n; i++) {
      if (want[i] !== have[i]) {
        problems.push(`${path} is stale at line ${i + 1}:\n  on disk:   ${JSON.stringify(have[i] ?? "<end of file>").slice(0, 200)}\n  generated: ${JSON.stringify(want[i] ?? "<end of file>").slice(0, 200)}\nRun npm run notices.`);
        break;
      }
    }
  }
  return { problems, warnings: built.warnings, pythonAvailable: built.pythonAvailable, built };
}

async function main() {
  const check = process.argv.includes("--check");
  if (check) {
    const { problems, warnings } = await checkNotices();
    for (const w of warnings) console.warn(`warning: ${w}`);
    if (problems.length) {
      for (const p of problems) console.error(p);
      process.exit(1);
    }
    console.log("Third-party notices are current.");
    return;
  }
  const built = await buildNotices();
  for (const w of built.warnings) console.warn(`warning: ${w}`);
  if (!built.pythonAvailable) {
    console.error("The planner's Python packages could not be read; install them first: python3 -m pip install -r planner/requirements.txt");
    process.exit(1);
  }
  if (built.data.npm.problems.length) {
    console.error("Not written: fix the problems above first.");
    process.exit(1);
  }
  for (const [path, content] of Object.entries(built.files)) {
    writeFileSync(join(ROOT, path), content);
    console.log(`wrote ${path}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
