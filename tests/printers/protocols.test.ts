// What each adapter puts on the wire, read back from what its stand-in recorded: the parts of the interface contract that
// are about the protocol (no print on upload, digest instead of a plain password, which Duet mode was detected, and so on).
import { afterAll, describe, expect, it } from "vitest";
import { PrinterError, type PrinterAdapter } from "@/lib/printers/adapter";
import { BambuAdapter, closeAllBambuSessions } from "@/lib/printers/bambu";
import { DuetAdapter } from "@/lib/printers/duet";
import { FileOnlyAdapter } from "@/lib/printers/fileOnly";
import { MoonrakerAdapter } from "@/lib/printers/moonraker";
import { OctoPrintAdapter } from "@/lib/printers/octoprint";
import { PrusaLinkAdapter } from "@/lib/printers/prusalink";
import { digestHeader } from "@/lib/printers/digest";
import type { MultipartBody, StandIn } from "../standins/core";
import * as bambu from "../standins/bambu";
import * as duet from "../standins/duet";
import * as moonraker from "../standins/moonraker";
import * as octoprint from "../standins/octoprint";
import * as prusalink from "../standins/prusalink";

const closers: (() => Promise<unknown>)[] = [];
afterAll(async () => {
  await closeAllBambuSessions();
  await Promise.all(closers.map((c) => c()));
});
const track = async <T extends { close(): Promise<void> }>(p: Promise<T>) => {
  const s = await p;
  closers.push(() => s.close());
  return s;
};
const file = (t = "G28\n") => ({ data: new TextEncoder().encode(t) });
const rejects = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as PrinterError;
  }
  throw new Error("did not fail");
};

describe("OctoPrint on the wire", () => {
  it("uploads with no select and no print, selects before it starts, and pauses with an explicit action", async () => {
    const s: StandIn<unknown> = await track(octoprint.start({ apiKey: "ok-key-1234" }));
    const a = new OctoPrintAdapter({ address: s.url, apiKey: "ok-key-1234" });
    await a.upload(file(), "w.gcode");
    const up = s.requests.find((r) => r.path === "/api/files/local")!;
    const form = up.body as MultipartBody;
    expect(form.files[0].filename).toBe("w.gcode");
    expect(form.fields.print ?? "false").not.toBe("true");
    expect(form.fields.select ?? "false").not.toBe("true");
    await a.start("w.gcode");
    const order = s.requests.filter((r) => r.method === "POST").map((r) => `${r.path} ${JSON.stringify((r.body as object) ?? {})}`);
    expect(order.slice(-2)).toEqual(['/api/files/local/w.gcode {"command":"select","print":false}', '/api/job {"command":"start"}']);
    await a.pause();
    expect(s.requests.at(-1)?.body).toEqual({ command: "pause", action: "pause" });
    await a.resume();
    expect(s.requests.at(-1)?.body).toEqual({ command: "pause", action: "resume" });
    expect(s.requests.every((r) => r.headers["x-api-key"] === "ok-key-1234")).toBe(true);
  });
});

describe("Moonraker on the wire", () => {
  it("uploads to the gcodes root without the print flag and starts by file name", async () => {
    const s = await track(moonraker.start());
    const a = new MoonrakerAdapter({ address: s.url });
    await a.upload(file(), "m.gcode");
    const form = s.requests.find((r) => r.path === "/server/files/upload")!.body as MultipartBody;
    expect(form.fields.root).toBe("gcodes");
    expect(form.fields.print ?? "false").not.toBe("true");
    await a.start("m.gcode");
    expect(s.requests.at(-1)).toMatchObject({ method: "POST", path: "/printer/print/start", query: { filename: "m.gcode" } });
    expect(s.requests.some((r) => r.headers["x-api-key"])).toBe(false);
  });

  it("labels Creality and Elegoo as experimental and plain Moonraker as not", () => {
    expect(new MoonrakerAdapter({ address: "http://x" }).capabilities.experimental).toBe(false);
    const c = new MoonrakerAdapter({ address: "http://x" }, { experimental: true, family: "creality" });
    expect(c.capabilities.experimental).toBe(true);
    expect(c.family).toBe("creality");
  });
});

describe("PrusaLink on the wire", () => {
  it("signs in with HTTP digest and never sends the password itself", async () => {
    const s = await track(prusalink.start({ auth: "digest", password: "pw-prusa-digest-1" }));
    const a = new PrusaLinkAdapter({ address: s.url, username: "maker", password: "pw-prusa-digest-1" });
    expect((await a.test()).ok).toBe(true);
    await a.upload(file(), "p.gcode");
    const signed = s.requests.filter((r) => String(r.headers.authorization ?? "").startsWith("Digest "));
    expect(signed.length).toBeGreaterThan(2);
    const wire = JSON.stringify(s.requests.map((r) => [r.path, r.query, r.headers, r.rawBody.toString("latin1")]));
    expect(wire).not.toContain("pw-prusa-digest-1");
    expect(wire).not.toMatch(/authorization":"Basic/i);
    const put = s.requests.find((r) => r.method === "PUT")!;
    expect(put.path).toBe("/api/v1/files/usb/p.gcode");
    expect(put.headers["print-after-upload"]).toBe("?0");
    expect(put.headers["overwrite"]).toBe("?1");
  });

  it("uses the default user name maker when only a password is given", async () => {
    const s = await track(prusalink.start({ auth: "digest", user: "maker", password: "pw-prusa-digest-2" }));
    const a = new PrusaLinkAdapter({ address: s.url, password: "pw-prusa-digest-2" });
    expect((await a.test()).ok).toBe(true);
  });

  it("signs in with X-Api-Key when only a key is given", async () => {
    const s = await track(prusalink.start({ auth: "key", apiKey: "prusa-key-7777", versionOpen: false }));
    const a = new PrusaLinkAdapter({ address: s.url, apiKey: "prusa-key-7777" });
    expect((await a.status()).state).toBe("idle");
    expect(s.requests.every((r) => r.headers["x-api-key"] === "prusa-key-7777")).toBe(true);
    expect(s.requests.some((r) => r.headers.authorization)).toBe(false);
  });

  it("says what to supply when neither a password nor a key is given", async () => {
    const t = await new PrusaLinkAdapter({ address: "http://127.0.0.1:1" }).test();
    expect(t.ok).toBe(false);
    expect(t.message).toMatch(/password|API key/);
  });

  it("refuses an upload when the printer has no writable storage", async () => {
    const s = await track(prusalink.start({ auth: "key", apiKey: "k-1234", versionOpen: false, storages: [{ path: "/usb", available: true, read_only: true }] }));
    const e = await rejects(new PrusaLinkAdapter({ address: s.url, apiKey: "k-1234" }).upload(file(), "x.gcode"));
    expect(e.message).toMatch(/no storage/i);
  });

  it("answers an RFC 7616 challenge the way the stand-in's own check computes it", () => {
    const h = digestHeader('Digest realm="Prusa-Link", nonce="abc123", qop="auth", algorithm=MD5', "GET", "/api/v1/status", "maker", "pw")!;
    expect(h).toMatch(/^Digest username="maker", realm="Prusa-Link", nonce="abc123", uri="\/api\/v1\/status", algorithm=MD5, response="[0-9a-f]{32}", qop=auth, nc=00000001, cnonce="[0-9a-f]+"/);
    expect(digestHeader("Basic realm=x", "GET", "/", "u", "p")).toBeNull();
  });
});

describe("Duet on the wire", () => {
  it("detects SBC mode and standalone mode and says which", async () => {
    for (const mode of ["sbc", "standalone"] as const) {
      const s = await track(duet.start({ mode, password: "duet-pw-4321" }));
      const t = await new DuetAdapter({ address: s.url, password: "duet-pw-4321" }).test();
      expect(t.ok).toBe(true);
      expect(t.message).toContain(mode === "sbc" ? "SBC mode" : "standalone mode");
      expect(t.detail).toMatchObject({ mode });
    }
  });

  it("starts with M32, pauses with M25, resumes with M24 and cancels with M0, in the right dialect", async () => {
    for (const mode of ["sbc", "standalone"] as const) {
      const s = await track(duet.start({ mode, password: "" }));
      const a = new DuetAdapter({ address: s.url });
      await a.upload(file(), "d.gcode");
      await a.start("d.gcode");
      await a.pause();
      await a.resume();
      await a.cancel();
      const codes = s.requests
        .filter((r) => r.path === "/rr_gcode" || r.path === "/machine/code")
        .map((r) => (r.path === "/rr_gcode" ? r.query.gcode : String(r.body)));
      expect(codes).toEqual(['M32 "d.gcode"', "M25", "M24", "M0"]);
    }
  });

  it("signs in again once when the board has forgotten the session", async () => {
    for (const mode of ["sbc", "standalone"] as const) {
      const s = await track(duet.start({ mode, password: "duet-pw-1" }));
      const a = new DuetAdapter({ address: s.url, password: "duet-pw-1" });
      expect((await a.status()).state).toBe("idle");
      s.forgetSessions();
      expect((await a.status()).state).toBe("idle");
    }
  });

  it("a board with no password set is reached without one", async () => {
    const s = await track(duet.start({ password: "" }));
    expect((await new DuetAdapter({ address: s.url }).test()).ok).toBe(true);
  });
});

describe("Bambu on the wire", () => {
  const setup = async (o: Partial<bambu.BambuStandInOptions> = {}) => {
    const s = await track(bambu.start(o));
    const adapter = (over: Record<string, string> = {}, ms = 4_000) =>
      new BambuAdapter({ address: s.host, accessCode: s.accessCode, serial: s.serial, ...over }, { mqttPort: s.mqttPort, ftpPort: s.ftpPort, timeoutMs: ms });
    return { s, adapter };
  };

  it("connects over TLS to a self-signed certificate (the check is relaxed for this connection only) and uploads over implicit FTPS", async () => {
    const { s, adapter } = await setup();
    const a = adapter();
    const t = await a.test();
    expect(t.ok).toBe(true);
    expect(t.message).toMatch(/MQTT/);
    expect(t.message).toMatch(/FTPS.*answered/);
    expect(s.events.find((e) => e.kind === "connect")?.detail.user).toBe("bblp");
    await a.upload(file("PK-not-really-a-3mf"), "job.3mf");
    expect(s.uploads()).toEqual([{ name: "job.3mf", size: 19 }]);
    expect(s.readUpload("job.3mf").toString()).toBe("PK-not-really-a-3mf");
    expect(s.commands).toEqual([]);
    await a.close();
  });

  it("start sends project_file for a .3mf with QoS 1 and a sequence id, then the printer reports RUNNING", async () => {
    const { s, adapter } = await setup();
    const a = adapter();
    await a.upload(file("x"), "job.3mf");
    await a.start("job.3mf", { plate: 2, useAms: true, amsMapping: [0, 1], timelapse: true });
    const c = s.commands.at(-1)!;
    expect(c).toMatchObject({ command: "project_file", param: "Metadata/plate_2.gcode", file: "job.3mf", url: "ftp:///job.3mf", use_ams: true, ams_mapping: [0, 1], timelapse: true });
    expect(typeof c.sequence_id).toBe("string");
    const sent = s.events.find((e) => e.kind === "message" && (e.detail.body as { print?: { command?: string } }).print?.command === "project_file")!;
    expect(sent.detail.qos).toBe(1);
    const st = await a.status();
    expect(st).toMatchObject({ state: "printing", rawState: "RUNNING", progress: 3, secondsLeft: 2700 });
    await a.close();
  });

  it("start sends gcode_file for a plain .gcode", async () => {
    const { s, adapter } = await setup();
    const a = adapter();
    await a.start("raw.gcode");
    expect(s.commands.at(-1)).toMatchObject({ command: "gcode_file", param: "raw.gcode" });
    await a.close();
  });

  it("pause, resume and cancel send pause, resume and stop", async () => {
    const { s, adapter } = await setup();
    const a = adapter();
    await a.start("job.3mf");
    await a.pause();
    await a.resume();
    await a.cancel();
    expect(s.commands.slice(-3).map((c) => c.command)).toEqual(["pause", "resume", "stop"]);
    await a.close();
  });

  it("merges partial pushes (P1 and A1 send only what changed)", async () => {
    const { s, adapter } = await setup({ partial: true });
    const a = adapter();
    expect((await a.status()).state).toBe("idle");
    s.setState({ gcode_state: "RUNNING", mc_percent: 55 });
    await new Promise((r) => setTimeout(r, 150));
    const st = await a.status();
    expect(st).toMatchObject({ state: "printing", progress: 55 });
    expect(st.temperatures.nozzle?.actual).toBe(24.5);
    await a.close();
  });

  it("with Developer Mode off the printer refuses a command and the sentence says to turn it on", async () => {
    const { adapter } = await setup({ developerMode: false });
    const a = adapter();
    const e = await rejects(a.start("job.3mf"));
    expect(e.kind).toBe("failed");
    expect(e.message).toMatch(/Developer Mode/);
    await a.close();
  });

  it("a printer that never acknowledges a command ends in a timeout that says to check the printer", async () => {
    const { adapter } = await setup({ mute: true });
    const a = adapter({}, 300);
    const e = await rejects(a.pause());
    expect(e.kind).toBe("timeout");
    expect(e.message).toMatch(/check the printer/i);
    await a.close();
  });

  it("a wrong serial number is refused at the subscription, with a sentence naming it", async () => {
    const { adapter } = await setup();
    const e = await rejects(adapter({ serial: "WRONGSERIAL0001" }).status());
    expect(e.kind).toBe("refused");
    expect(e.message).toMatch(/serial/i);
  });

  it("a missing serial, address or access code is refused before anything is sent", async () => {
    const { s, adapter } = await setup();
    for (const [k, re] of [["serial", /serial/i], ["accessCode", /access code/i], ["address", /address/i]] as const) {
      const e = await rejects(adapter({ [k]: "" }).status());
      expect(e.kind).toBe("invalid");
      expect(e.message).toMatch(re);
    }
    expect(s.events).toEqual([]);
  });

  it("holds one connection across calls and releases it on close", async () => {
    const { s, adapter } = await setup();
    const a = adapter();
    await a.status();
    await a.status();
    expect(s.events.filter((e) => e.kind === "connect")).toHaveLength(1);
    await a.close();
    await adapter().status();
    expect(s.events.filter((e) => e.kind === "connect")).toHaveLength(2);
    await closeAllBambuSessions();
  });

  it("the FTPS port refusing the code is reported by test() without failing the MQTT result", async () => {
    const { s, adapter } = await setup();
    s.set({ accessCode: s.accessCode }); // same code for MQTT...
    const a = new BambuAdapter({ address: s.host, accessCode: s.accessCode, serial: s.serial }, { mqttPort: s.mqttPort, ftpPort: 1, timeoutMs: 1500 });
    const t = await a.test();
    expect(t.ok).toBe(true);
    expect(t.message).toMatch(/did not answer/);
    await a.close();
    void adapter;
  });
});

describe("file-only", () => {
  it("tests ok, reports no status and refuses every action with a sentence", async () => {
    const a: PrinterAdapter = new FileOnlyAdapter();
    expect((await a.test()).ok).toBe(true);
    expect(a.capabilities).toMatchObject({ status: false, upload: false, start: false, pause: false, resume: false, cancel: false });
    for (const call of [() => a.status(), () => a.upload(file(), "x.gcode"), () => a.start("x.gcode"), () => a.pause(), () => a.resume(), () => a.cancel()]) {
      const e = await rejects(call());
      expect(e.kind).toBe("unsupported");
      expect(e.message).toMatch(/file|by hand|download/i);
    }
  });
});
