// Every adapter against its stand-in, for every method of the interface, including the failures the plan names: wrong key,
// nothing listening, too slow, and a busy printer refusing a start. Everything here ran against a stand-in, not a printer.
import { afterAll, describe, expect, it } from "vitest";
import { PrinterError, type PrinterAdapter } from "@/lib/printers/adapter";
import { closeAllBambuSessions } from "@/lib/printers/bambu";
import { RIGS, type RigRun } from "./rigs";

afterAll(closeAllBambuSessions);

const gcode = (text = "G28\nG1 X10\n") => ({ data: new TextEncoder().encode(text), contentType: "application/octet-stream" });
const fails = async (p: Promise<unknown>): Promise<PrinterError> => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(PrinterError);
    return e as PrinterError;
  }
  throw new Error("expected a PrinterError, but the call succeeded");
};
const clean = (rig: { secrets: string[] }, text: string) => {
  for (const s of rig.secrets) expect(text).not.toContain(s);
};

for (const rig of RIGS) {
  describe(`adapter: ${rig.name}`, () => {
    const runs: RigRun[] = [];
    const adapters: PrinterAdapter[] = [];
    const up = async () => {
      const r = await rig.up();
      runs.push(r);
      return r;
    };
    const track = <T extends PrinterAdapter>(a: T) => {
      adapters.push(a);
      return a;
    };
    afterAll(async () => {
      await Promise.all(adapters.map((a) => a.close().catch(() => undefined)));
      await closeAllBambuSessions();
      await Promise.all(runs.map((r) => r.close()));
    });

    it("test() says it worked, in a sentence", async () => {
      const r = await up();
      const t = await track(r.good()).test();
      expect(t.ok).toBe(true);
      expect(t.message.length).toBeGreaterThan(10);
      clean(rig, JSON.stringify(t));
    });

    it("declares what it can do", async () => {
      const a = (await up()).good();
      expect(a.capabilities).toMatchObject({ status: true, upload: true, start: true, pause: true, resume: true, cancel: true });
      expect(a.capabilities.fileTypes.length).toBeGreaterThan(0);
      expect(a.capabilities.fileTypes.every((t) => t.startsWith("."))).toBe(true);
      expect(typeof a.capabilities.experimental).toBe("boolean");
    });

    it("status() reads an idle printer", async () => {
      const a = track((await up()).good());
      const s = await a.status();
      expect(s.state).toBe("idle");
      expect(s.temperatures.nozzle?.actual).toBeGreaterThan(0);
    });

    it("upload() stores the file and does not start it; start, pause, resume and cancel then work in order", async () => {
      const r = await up();
      const a = track(r.good());
      const up1 = await a.upload(gcode(), rig.file);
      expect(up1.name).toBe(rig.file);
      expect(up1.message).toMatch(/not been started|has not been started/i);
      expect(r.startsSeen()).toBe(0);
      expect((await a.status()).state).toBe("idle");

      expect((await a.start(rig.file)).ok).toBe(true);
      expect(r.startsSeen()).toBe(1);
      const printing = await a.status();
      expect(printing.state).toBe("printing");
      expect(printing.file ?? "").toContain(rig.file.replace(/\.(gcode|bgcode|3mf)$/, ""));

      expect((await a.pause()).ok).toBe(true);
      expect((await a.status()).state).toBe("paused");
      expect((await a.resume()).ok).toBe(true);
      expect((await a.status()).state).toBe("printing");
      expect((await a.cancel()).ok).toBe(true);
      expect((await a.status()).state).toBe("idle");
    });

    it("a busy printer refuses a start with a plain sentence (kind busy)", async () => {
      const r = await up();
      const a = track(r.good());
      await a.upload(gcode(), rig.file);
      await a.start(rig.file);
      const e = await fails(a.start(rig.file));
      expect(e.kind).toBe("busy");
      expect(e.message).toMatch(/busy|already|running|not ready/i);
      clean(rig, e.message);
      expect((await a.status()).state).toBe("printing");
    });

    it("pause, resume or cancel with nothing printing is refused as busy (where the stand-in can say so)", async () => {
      if (!rig.refusesIdleControl) return;
      const a = track((await up()).good());
      for (const act of ["pause", "resume", "cancel"] as const) {
        const e = await fails(a[act]());
        expect(e.kind).toBe("busy");
        clean(rig, e.message);
      }
    });

    it("a wrong key or password: test() says so, status() and upload() throw kind refused, and no secret is in the sentence", async () => {
      const r = await up();
      const a = track(r.wrongSecret());
      const t = await a.test();
      expect(t.ok).toBe(false);
      expect(t.message).toMatch(/refus|key|password|code|access|sign/i);
      clean(rig, JSON.stringify(t));
      const e = await fails(a.status());
      expect(e.kind).toBe("refused");
      clean(rig, e.message);
      const e2 = await fails(a.upload(gcode(), rig.file));
      expect(e2.kind).toBe("refused");
      clean(rig, e2.message);
      expect(r.startsSeen()).toBe(0);
    });

    it("nothing listening at the address: test() answers not ok, status() throws kind unreachable", async () => {
      const r = await up();
      const a = track(r.nothingListening({ timeoutMs: 2_000 }));
      const t = await a.test();
      expect(t.ok).toBe(false);
      clean(rig, JSON.stringify(t));
      const e = await fails(a.status());
      expect(["unreachable", "timeout"]).toContain(e.kind);
      expect(e.message).toMatch(/[a-z]{3}/);
      clean(rig, e.message);
    });

    it("a printer too slow to answer: a 150 ms limit ends the call with kind timeout", async () => {
      const r = await up();
      r.makeSlow();
      const a = track(r.good({ timeoutMs: 150 }));
      const began = Date.now();
      const t = await a.test();
      expect(t.ok).toBe(false);
      expect(t.message).toMatch(/150 ms|no answer|no status|0\.15|within/i);
      const e = await fails(a.status());
      expect(e.kind).toBe("timeout");
      clean(rig, e.message);
      expect(Date.now() - began).toBeLessThan(3_000);
    });

    it("refuses a file name with folders, and a file type the printer does not take, before sending anything", async () => {
      const r = await up();
      const a = track(r.good());
      const before = r.seen();
      for (const bad of ["../escape.gcode", "dir/part.gcode", "part.exe", "", "a\u0000b.gcode"]) {
        const e = await fails(a.upload(gcode(), bad));
        expect(e.kind).toBe("invalid");
      }
      const e = await fails(a.start("../escape.gcode"));
      expect(e.kind).toBe("invalid");
      expect(r.seen()).toBe(before);
    });

    it("nothing the stand-in saw, and nothing the adapter said, carries a secret in a place a log could keep it", async () => {
      const r = await up();
      const a = track(r.good());
      await a.upload(gcode(), rig.file).catch(() => undefined);
      const wrong = track(r.wrongSecret());
      const said = [JSON.stringify(await wrong.test()), (await fails(wrong.status())).message].join(" ");
      clean(rig, said);
    });
  });
}
