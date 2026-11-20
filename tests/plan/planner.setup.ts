// Vitest global setup: starts the real NetworkX planner for the test run and stops it at the end.
// The plan API test reads its address with inject("plannerUrl"). If python3 or uvicorn is missing
// the run fails here with a message; it never skips.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    plannerUrl: string;
  }
}

const PLANNER_DIR = fileURLToPath(new URL("../../planner", import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a ? a.port : 0;
      s.close(() => resolve(port));
    });
  });
}

export default async function setup(project: TestProject) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  let output = "";
  let exited: string | null = null;
  const child: ChildProcess = spawn("python3", ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: PLANNER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (b) => (output += b));
  child.stderr?.on("data", (b) => (output += b));
  child.on("error", (e) => (exited = `could not start python3: ${e.message}`));
  child.on("exit", (code, signal) => (exited ??= `exited with ${code ?? signal}`));

  const fail = (why: string): never => {
    child.kill("SIGKILL");
    throw new Error(
      `The planner service is needed by the tests and did not start (${why}).\n` +
        `Install it with: python3 -m pip install -r planner/requirements-dev.txt\n` +
        `Its output:\n${output.trim() || "(none)"}`
    );
  };

  const deadline = Date.now() + 30_000;
  for (;;) {
    if (exited) fail(exited);
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (r.ok && ((await r.json()) as { ok?: boolean }).ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) fail("no answer from /health within 30 s");
    await new Promise((r) => setTimeout(r, 150));
  }

  project.provide("plannerUrl", url);

  return async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const gone = new Promise<void>((r) => child.once("exit", () => r()));
    child.kill("SIGTERM");
    await Promise.race([gone, new Promise((r) => setTimeout(r, 5000))]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  };
}
