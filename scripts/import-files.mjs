#!/usr/bin/env node
// Uploads every file in a folder into one concept's Files, through the app's own API. Files in a sub-folder
// (one level) go into a folder of the same name in the concept.
//
//   node scripts/import-files.mjs <folder> --concept <concept id> --url <app address> [--cookie <session cookie>] [--dry-run]
//
// Signing in: pass the value of your c2r_session cookie with --cookie (or in the C2R_SESSION environment
// variable), copied from a signed-in browser; or leave it out and the script asks for a username and a password
// in the terminal, signs in, and signs out again at the end. The password is typed without echo, sent only in the
// sign-in request, and never stored or printed.
//
// A file whose name matches a source already listed with no file (the example concept lists its documents this
// way) fills that source in, so the story parts that cite it keep citing it. Word files are skipped: the app has
// no reader for them. Files over 25 MB are skipped. Nothing else in the folder is touched.
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createInterface } from "node:readline";

const COOKIE = "c2r_session";
const MAX_BYTES = 25 * 1024 * 1024;
const READABLE = new Set([".md", ".markdown", ".txt", ".text", ".csv", ".tsv", ".json", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".sql", ".yml", ".yaml", ".toml", ".ini", ".ino", ".c", ".h", ".cpp", ".hpp", ".py", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".sh", ".html", ".css", ".xml"]);
const MIME = { ".pdf": "application/pdf", ".csv": "text/csv", ".tsv": "text/tab-separated-values", ".json": "application/json", ".md": "text/markdown", ".markdown": "text/markdown", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/import-files.mjs <folder> --concept <concept id> --url <app address> [--cookie <session cookie>] [--dry-run]");
  process.exit(2);
}

export function parseArgs(argv) {
  const out = { folder: "", concept: "", url: "", cookie: process.env.C2R_SESSION ?? "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--concept") out.concept = argv[++i] ?? "";
    else if (a === "--url") out.url = argv[++i] ?? "";
    else if (a === "--cookie") out.cookie = argv[++i] ?? "";
    else if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--")) usage(`Unknown option ${a}.`);
    else if (!out.folder) out.folder = a;
    else usage(`Only one folder, please (got "${out.folder}" and "${a}").`);
  }
  if (!out.folder || !out.concept || !out.url) usage("A folder, --concept and --url are all needed.");
  try {
    const u = new URL(out.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    out.url = u.origin;
  } catch {
    usage(`"${out.url}" is not an http or https address.`);
  }
  // A pasted "c2r_session=abc" or the bare value both work.
  out.cookie = out.cookie.replace(new RegExp(`^${COOKIE}=`), "").trim();
  return out;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo nothing while the password is typed.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function api(base, cookie, path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie: `${COOKIE}=${cookie}` } });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }
  return { status: res.status, body, res };
}

async function signIn(base) {
  const username = (await ask("Username: ")).trim();
  const password = await ask("Password (not shown): ", { hidden: true });
  const res = await fetch(`${base}/api/auth/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(`Sign-in refused: ${b.error ?? res.status}`);
  }
  const set = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  const token = set.map((c) => c.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1]).find(Boolean);
  if (!token) throw new Error("Sign-in answered without a session cookie.");
  return token;
}

export async function filesIn(folder, sub = "") {
  const out = [];
  for (const name of (await readdir(folder)).sort((a, b) => a.localeCompare(b))) {
    if (name.startsWith(".")) continue;
    const path = join(folder, name);
    const s = await stat(path);
    if (s.isDirectory() && !sub) out.push(...(await filesIn(path, name)));
    else if (s.isFile()) out.push({ name, path, size: s.size, ext: extname(name).toLowerCase(), folder: sub });
  }
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const o = parseArgs(argv);
  const files = await filesIn(o.folder);
  if (!files.length) {
    console.log(`No files in ${o.folder}.`);
    return { added: 0, skipped: 0, failed: 0 };
  }
  let cookie = o.cookie;
  let ours = false;
  if (!o.dryRun && !cookie) {
    cookie = await signIn(o.url);
    ours = true;
  }
  const counts = { added: 0, skipped: 0, failed: 0 };
  try {
    if (!o.dryRun) {
      const check = await api(o.url, cookie, `/api/projects/${encodeURIComponent(o.concept)}`);
      if (check.status === 401) throw new Error("The session is not signed in. Copy a fresh c2r_session cookie, or leave --cookie out to sign in here.");
      if (check.status === 404) throw new Error(`There is no concept "${o.concept}" at ${o.url}.`);
      if (check.status !== 200) throw new Error(`The app answered ${check.status}: ${check.body.error ?? ""}`);
      console.log(`Importing ${files.length} files into "${check.body.project?.name ?? o.concept}" at ${o.url}.`);
    }
    for (const f of files) {
      if (!READABLE.has(f.ext)) {
        console.log(`skip  ${f.name}: not a kind of file the app reads${[".doc", ".docx"].includes(f.ext) ? " (save Word files as PDF)" : ""}`);
        counts.skipped++;
        continue;
      }
      if (f.size > MAX_BYTES) {
        console.log(`skip  ${f.name}: larger than 25 MB`);
        counts.skipped++;
        continue;
      }
      if (o.dryRun) {
        console.log(`would add  ${f.name} (${f.size} bytes)`);
        continue;
      }
      const form = new FormData();
      form.append("file", new Blob([await readFile(f.path)], { type: MIME[f.ext] ?? "text/plain" }), basename(f.path));
      form.append("title", f.name);
      form.append("origin", "Imported from a folder with scripts/import-files.mjs");
      if (f.folder) form.append("folder", f.folder);
      const r = await api(o.url, cookie, `/api/projects/${encodeURIComponent(o.concept)}/sources`, { method: "POST", body: form });
      if (r.status === 201) {
        const idx = r.body.index?.ok ? "indexed by meaning" : "found by words";
        console.log(`added ${f.folder ? `${f.folder}/` : ""}${f.name}: ${r.body.chunks} passages, ${idx}`);
        counts.added++;
      } else {
        console.log(`fail  ${f.name}: ${r.body.error ?? r.status}`);
        counts.failed++;
        if (r.status === 401) break;
      }
    }
  } finally {
    if (ours) await api(o.url, cookie, "/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
  }
  console.log(`Done: ${counts.added} added, ${counts.skipped} skipped, ${counts.failed} failed.`);
  return counts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (c) => process.exit(c.failed ? 1 : 0),
    (e) => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
