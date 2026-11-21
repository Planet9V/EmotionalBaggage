// Secrets never appear in any response, log or error: every adapter is driven through working calls and through the failures
// (wrong secret, nothing listening, too slow), and everything it returned, threw or wrote to the console is scanned for each secret.
// The audit lines and route responses are scanned in routes.test.ts.
import { afterAll, describe, expect, it, vi } from "vitest";
import { closeAllBambuSessions } from "@/lib/printers/bambu";
import type { PrinterAdapter } from "@/lib/printers/adapter";
import { RIGS } from "./rigs";

afterAll(closeAllBambuSessions);

const text = (e: unknown) => (e instanceof Error ? `${e.name} ${e.message} ${e.stack ?? ""}` : JSON.stringify(e));

describe("no secret leaves an adapter", () => {
  for (const rig of RIGS) {
    it(`${rig.name}: results, thrown errors, error stacks and console output`, async () => {
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
      const seen: string[] = [];
      const run = await rig.up();
      const attempt = async (a: PrinterAdapter) => {
        const calls: (() => Promise<unknown>)[] = [
          () => a.test(), () => a.status(), () => a.upload({ data: new Uint8Array([71, 50, 56]) }, rig.file), () => a.start(rig.file), () => a.pause(), () => a.resume(), () => a.cancel(),
        ];
        for (const c of calls) {
          try {
            seen.push(JSON.stringify(await c()));
          } catch (e) {
            seen.push(text(e));
          }
        }
        await a.close();
      };
      try {
        await attempt(run.good({ timeoutMs: 1_500 }));
        await attempt(run.wrongSecret({ timeoutMs: 1_500 }));
        await attempt(run.nothingListening({ timeoutMs: 1_500 }));
        run.makeSlow();
        await attempt(run.good({ timeoutMs: 150 }));
      } finally {
        await closeAllBambuSessions();
        await run.close();
      }
      const logged = spies.flatMap((s) => s.mock.calls.map((c) => c.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")));
      spies.forEach((s) => s.mockRestore());
      expect(seen.length).toBeGreaterThan(20);
      for (const secret of rig.secrets) {
        expect(seen.join("\n")).not.toContain(secret);
        expect(logged.join("\n")).not.toContain(secret);
      }
    }, 60_000);
  }
});
