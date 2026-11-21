// Bambu Lab printers over the local network (plan 6.3). Packages: `mqtt` (MQTT.js) and `basic-ftp`.
//
// What was read, and where (read 21 Nov 2026):
//   Bambu's wiki, https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode
//     "Developer Mode ... will open the MQTT channel, live stream, and FTP"; steps for H2 series/P2S, X series, P series, A series:
//     LAN Only mode first, then Developer Mode.
//   Bambu's wiki, https://wiki.bambulab.com/en/software/third-party-integration
//     the authorization mechanism: starting a print from other software and controlling movement, temperature, fans, AMS and
//     calibration need Bambu Connect "in cloud mode and normal LAN mode (except for developer mode)"; MQTT status pushes and
//     starting prints from the SD card are not affected; Developer Mode "functions the same as in previous firmware versions and
//     does not require authorization verification" and cannot be used with Bambu Cloud.
//   Bambu's blog, 20 Jan 2025, https://blog.bambulab.com/updates-and-third-party-integration-with-bambu-connect : the optional
//     Developer Mode leaves the MQTT channel, live stream and FTP open; Bambu gives no support for it ("not officially supported").
//   Community protocol notes (not Bambu's own), https://github.com/Doridian/OpenBambuAPI : mqtt.md and ftp.md
//     MQTT over TLS on port 8883, user bblp, password = the LAN access code, topics device/<serial>/report and /request;
//     pushall (P1 and A1 send only changes after it); print commands pause, resume, stop (QoS 1) and project_file;
//     FTPS, implicit TLS, port 990, user bblp, the same access code; tls.md says the certificate chains to a Bambu CA and the
//     name in it is not the IP address.
//   gcode_state values IDLE, PREPARE, RUNNING, PAUSE, FINISH, FAILED are from community integrations; only IDLE appears in the
//     OpenBambuAPI example. This adapter maps an unknown word to "unknown" rather than guessing.
//
// THE CERTIFICATE CHECK IS RELAXED HERE, AND ONLY HERE. The printer's certificate is self-signed by Bambu, so the TLS connections
// to the printer on port 8883 and 990 skip certificate verification (rejectUnauthorized: false). Nothing else in this app does
// that. The connection stays on the local network; anyone on that network able to answer as the printer could read the access
// code. Pinning Bambu's CA (the community's tls.md describes it) would be better and is not built.
//
// Firmware that needs Developer Mode: Bambu's own pages say it for X-series first (the beta announced 17 Jan 2025 is firmware
// 01.08.03.00 or above; the forum thread for the release is titled 01.08.05.00), then P-series and A-series "in future firmware
// updates"; no version number for P and A was found on a Bambu page. Treat any current firmware as needing Developer Mode for control.
// Read-only status: Bambu says MQTT status pushes are not affected by the authorization mechanism, but whether the broker answers
// at all without Developer Mode on the newest firmware was not confirmed. Test it with the Test button.
import { createHash, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import mqtt, { type MqttClient } from "mqtt";
import { Client as FtpClient } from "basic-ftp";
import { blockedIn, blockedSentence, resolveAllowed } from "@/lib/net/outbound";
import {
  PrinterError, safeFileName, DEFAULT_TIMEOUT_MS,
  type ActionResult, type AdapterOptions, type Capabilities, type PrinterAdapter, type PrinterFile, type PrinterState, type PrinterStatus,
  type PrinterValues, type StartOptions, type TestOutcome, type UploadResult,
} from "./adapter";
import { num, secondsText, str } from "./http";
import { scrub } from "@/lib/secrets/scrub";

export type BambuOptions = AdapterOptions & {
  /** MQTT port; the printer's is 8883. Only tests change it. */
  mqttPort?: number;
  /** FTPS port; the printer's is 990. Only tests change it. */
  ftpPort?: number;
};

const STATES: Record<string, PrinterState> = { IDLE: "idle", PREPARE: "busy", RUNNING: "printing", PAUSE: "paused", FINISH: "finished", FAILED: "error" };
const IDLE_CLOSE_MS = 90_000;
const FRESH_MS = 30_000;

type Report = Record<string, unknown>;

type Session = {
  key: string;
  client: MqttClient;
  state: Report;
  lastMessageAt: number;
  lastUsedAt: number;
  seq: number;
  waiters: Map<string, (r: Report) => void>;
  idle: NodeJS.Timeout;
  gotPush: boolean;
  onPush: Set<() => void>;
};

const POOL_KEY = Symbol.for("c2r.bambu.sessions");
const pool = ((globalThis as Record<symbol, unknown>)[POOL_KEY] ??= new Map<string, Session>()) as Map<string, Session>;

/** Closes every held MQTT connection. Used by tests and on shutdown. */
export async function closeAllBambuSessions(): Promise<void> {
  for (const s of [...pool.values()]) dropSession(s);
}

function dropSession(s: Session) {
  clearTimeout(s.idle);
  pool.delete(s.key);
  try {
    s.client.end(true);
  } catch {
    // already closed
  }
}

function mqttSentence(e: unknown, secrets: string[], ms: number): PrinterError {
  const err = e as { code?: string | number; message?: string; name?: string };
  const msg = String(err?.message ?? e);
  if (/bad user name or password|not authorized|code 4|code 5|\b134\b|\b135\b/i.test(msg) || err?.code === 4 || err?.code === 5 || err?.code === 134 || err?.code === 135) {
    return new PrinterError("refused", "The printer refused the access code or the serial number. Check both on the printer: Settings, LAN Only.");
  }
  if (err?.code === "ECONNREFUSED" || /ECONNREFUSED/.test(msg)) {
    return new PrinterError("unreachable", "Nothing answered on the MQTT port (8883). Check the address, and that LAN Only mode and Developer Mode are on at the printer.");
  }
  if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN") return new PrinterError("unreachable", "That host name could not be found. Check the address.");
  if (err?.code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) return new PrinterError("timeout", `No answer within ${secondsText(ms)}.`);
  if (err?.code === "ECONNRESET") return new PrinterError("unreachable", "The connection was dropped before an answer came back.");
  return new PrinterError("unreachable", `Could not reach the printer: ${scrub(msg, secrets).slice(0, 200)}`);
}

export class BambuAdapter implements PrinterAdapter {
  readonly family = "bambu";
  readonly capabilities: Capabilities = {
    status: true, upload: true, start: true, pause: true, resume: true, cancel: true, pushedStatus: true, experimental: false,
    fileTypes: [".3mf", ".gcode"],
    notes: [
      "Needs LAN Only mode and Developer Mode on at the printer, the access code and the serial number.",
      "The printer's certificate is self-signed, so the check is skipped for this local connection only.",
      "X1 series: a microSD card must be in the printer to start a print from the network.",
      "Written from Bambu's wiki and community protocol notes; confirm with the Test button on your own printer.",
    ],
  };
  private readonly host: string;
  private readonly code: string;
  private readonly serial: string;
  private readonly ms: number;
  private readonly mqttPort: number;
  private readonly ftpPort: number;

  constructor(v: PrinterValues, o: BambuOptions = {}) {
    this.host = (v.address ?? "").trim();
    this.code = v.accessCode ?? "";
    this.serial = (v.serial ?? "").trim();
    this.ms = o.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.mqttPort = o.mqttPort ?? 8883;
    this.ftpPort = o.ftpPort ?? 990;
  }
  private secrets() {
    return [this.code];
  }
  private need(): void {
    if (!this.host) throw new PrinterError("invalid", "The printer's IP address is missing.");
    if (!this.code) throw new PrinterError("invalid", "The access code is missing. It is shown on the printer once LAN Only mode is on.");
    if (!this.serial) throw new PrinterError("invalid", "The serial number is missing. It is on the printer's label and under Settings, Device.");
  }

  /** The checked address to connect to (src/lib/net/outbound.ts): MQTT and FTP connect to it, not to the name. */
  private async target(): Promise<string> {
    try {
      return await resolveAllowed(this.host);
    } catch (e) {
      const refused = blockedIn(e);
      if (refused) throw new PrinterError("invalid", blockedSentence(refused));
      return this.host; // a name that does not resolve: the client reports it in its own words
    }
  }

  private async session(): Promise<Session> {
    this.need();
    const key = `${this.host}:${this.mqttPort}|${this.serial}|${createHash("sha256").update(this.code).digest("hex").slice(0, 8)}`;
    const found = pool.get(key);
    if (found && found.client.connected) {
      found.lastUsedAt = Date.now();
      return found;
    }
    if (found) dropSession(found);
    const host = await this.target();
    const client = await new Promise<MqttClient>((resolve, reject) => {
      const c = mqtt.connect({
        protocol: "mqtts", host, port: this.mqttPort, username: "bblp", password: this.code,
        clientId: `c2r-${randomBytes(4).toString("hex")}`,
        // Skipped for this one local connection to the printer: its certificate is self-signed by Bambu. See the note at the top.
        rejectUnauthorized: false,
        connectTimeout: this.ms, reconnectPeriod: 0, keepalive: 30, protocolVersion: 4,
      });
      const fail = (e: unknown) => {
        c.end(true);
        reject(mqttSentence(e, this.secrets(), this.ms));
      };
      c.once("connect", () => {
        c.off("error", fail);
        resolve(c);
      });
      c.once("error", fail);
    });
    const s: Session = {
      key, client, state: {}, lastMessageAt: 0, lastUsedAt: Date.now(), seq: 0, waiters: new Map(), gotPush: false, onPush: new Set(),
      idle: setTimeout(() => undefined, 0),
    };
    clearTimeout(s.idle);
    const arm = () => {
      clearTimeout(s.idle);
      s.idle = setTimeout(() => {
        if (Date.now() - s.lastUsedAt >= IDLE_CLOSE_MS) dropSession(s);
        else arm();
      }, IDLE_CLOSE_MS);
      s.idle.unref?.();
    };
    arm();
    client.on("message", (_topic, payload) => {
      let j: Record<string, Report> | null = null;
      try {
        j = JSON.parse(payload.toString("utf8")) as Record<string, Report>;
      } catch {
        return;
      }
      s.lastMessageAt = Date.now();
      const p = j?.print;
      if (p && typeof p === "object") {
        // P1 and A1 push only what changed, so reports are merged.
        if (p.command === "push_status" || p.gcode_state !== undefined) {
          Object.assign(s.state, p);
          s.gotPush = true;
          for (const f of s.onPush) f();
        }
      }
      for (const body of Object.values(j ?? {})) {
        const id = body && typeof body === "object" ? (body as Report).sequence_id : undefined;
        if (typeof id === "string" && s.waiters.has(id)) {
          s.waiters.get(id)!(body as Report);
          s.waiters.delete(id);
        }
      }
    });
    client.on("close", () => {
      if (pool.get(key) === s) dropSession(s);
    });
    client.on("error", () => undefined);
    await new Promise<void>((resolve, reject) =>
      client.subscribe(`device/${this.serial}/report`, { qos: 0 }, (err, granted) => {
        if (err || granted?.some((g) => g.qos === 128)) {
          dropSession(s);
          reject(new PrinterError("refused", "The printer refused the subscription. Check the serial number and the access code."));
        } else resolve();
      })
    );
    pool.set(key, s);
    return s;
  }

  private publish(s: Session, body: Report, qos: 0 | 1 = 0): Promise<void> {
    return new Promise((resolve, reject) =>
      s.client.publish(`device/${this.serial}/request`, JSON.stringify(body), { qos }, (err) =>
        err ? reject(new PrinterError("failed", "The printer did not accept the command.")) : resolve()
      )
    );
  }

  /** Asks for a full report and waits for the first push. */
  private async fresh(s: Session): Promise<void> {
    if (s.gotPush && Date.now() - s.lastMessageAt < FRESH_MS) return;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        s.onPush.delete(done);
        reject(new PrinterError("timeout", `The printer connected but sent no status within ${secondsText(this.ms)}. Developer Mode may be off, or the serial number is wrong.`));
      }, this.ms);
      const done = () => {
        clearTimeout(t);
        s.onPush.delete(done);
        resolve();
      };
      s.onPush.add(done);
      this.publish(s, { pushing: { sequence_id: String(++s.seq), command: "pushall", version: 1, push_target: 1 } }).catch((e) => {
        clearTimeout(t);
        s.onPush.delete(done);
        reject(e);
      });
    });
  }

  async test(): Promise<TestOutcome> {
    try {
      const s = await this.session();
      s.gotPush = false;
      await this.fresh(s);
      const st = this.map(s.state);
      let upload = "";
      try {
        await this.ftp(async (c) => {
          await c.pwd();
        });
        upload = " File upload (FTPS, port 990) also answered.";
      } catch (e) {
        upload = ` File upload (FTPS, port 990) did not answer: ${(e as PrinterError).message}`;
      }
      return {
        ok: true,
        message: `The printer answered over MQTT${st.rawState ? `; its state is ${st.rawState}` : ""}.${upload}`,
        detail: { state: st.rawState, normalized: st.state },
      };
    } catch (e) {
      if (e instanceof PrinterError) return { ok: false, message: e.message };
      return { ok: false, message: `The test failed: ${scrub(String((e as Error)?.message ?? e), this.secrets()).slice(0, 200)}` };
    }
  }

  private map(m: Report): PrinterStatus {
    const raw = str(m.gcode_state);
    const state = raw ? (STATES[raw.toUpperCase()] ?? "unknown") : "unknown";
    const temp = (a: unknown, t: unknown) => (num(a) !== null ? { actual: a as number, target: num(t) } : undefined);
    const temperatures: PrinterStatus["temperatures"] = {};
    const n = temp(m.nozzle_temper, m.nozzle_target_temper);
    const b = temp(m.bed_temper, m.bed_target_temper);
    const c = temp(m.chamber_temper, null);
    if (n) temperatures.nozzle = n;
    if (b) temperatures.bed = b;
    if (c) temperatures.chamber = c;
    const err = num(m.print_error);
    const left = num(m.mc_remaining_time);
    return {
      state, rawState: raw, file: str(m.subtask_name) ?? str(m.gcode_file),
      progress: state === "idle" && num(m.mc_percent) === 0 ? null : num(m.mc_percent),
      secondsLeft: left !== null && (state === "printing" || state === "paused") ? Math.round(left * 60) : null,
      temperatures,
      ...(err ? { message: `The printer reports error code ${err}. Bambu's wiki lists the codes under HMS and print errors.` } : {}),
    };
  }

  async status(): Promise<PrinterStatus> {
    const s = await this.session();
    s.lastUsedAt = Date.now();
    await this.fresh(s);
    return this.map(s.state);
  }

  private async ftp<T>(run: (c: FtpClient) => Promise<T>): Promise<T> {
    this.need();
    const host = await this.target();
    const c = new FtpClient(this.ms);
    try {
      await c.access({
        host, port: this.ftpPort, user: "bblp", password: this.code, secure: "implicit",
        // Skipped for this one local connection to the printer: its certificate is self-signed by Bambu. See the note at the top.
        secureOptions: { rejectUnauthorized: false },
      });
      return await run(c);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      const code = (e as { code?: string | number }).code;
      if (/530|login|password/i.test(msg) || code === 530) throw new PrinterError("refused", "The printer refused the access code on the file port (FTPS). Check the access code.");
      if (code === "ECONNREFUSED") throw new PrinterError("unreachable", "Nothing answered on the file port (990). Developer Mode may be off.");
      if (/timeout|timed out/i.test(msg) || code === "ETIMEDOUT") throw new PrinterError("timeout", `No answer within ${secondsText(this.ms)} on the file port.`);
      if (e instanceof PrinterError) throw e;
      throw new PrinterError("failed", `The file transfer failed: ${scrub(msg, this.secrets()).slice(0, 200)}`);
    } finally {
      c.close();
    }
  }

  async upload(file: PrinterFile, name: string): Promise<UploadResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    await this.ftp(async (c) => {
      c.ftp.verbose = false;
      await c.uploadFrom(Readable.from(Buffer.from(file.data)), n);
    });
    return { name: n, message: `The printer stored ${n}. It has not been started.` };
  }

  /** Sends a print command and waits for the printer's report with the same sequence id. */
  private async command(body: Report, said: string): Promise<ActionResult> {
    const s = await this.session();
    s.lastUsedAt = Date.now();
    const id = String(++s.seq);
    const reply = new Promise<Report>((resolve, reject) => {
      const t = setTimeout(() => {
        s.waiters.delete(id);
        reject(new PrinterError("timeout", `The printer did not confirm within ${secondsText(this.ms)}. Check the printer before sending it again.`));
      }, this.ms);
      s.waiters.set(id, (r) => {
        clearTimeout(t);
        resolve(r);
      });
    });
    reply.catch(() => undefined);
    await this.publish(s, { print: { sequence_id: id, ...body } }, 1);
    const r = await reply;
    const result = String(r.result ?? "").toLowerCase();
    if (result && result !== "success") {
      const why = str(r.reason);
      throw new PrinterError("failed", `The printer refused: ${why ? scrub(why, this.secrets()).slice(0, 160) : `result ${result}`}. Developer Mode must be on for control from this app.`);
    }
    return { ok: true, message: said };
  }

  async start(name: string, options: StartOptions = {}): Promise<ActionResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    const cur = await this.status();
    if (cur.state === "printing" || cur.state === "paused" || cur.state === "busy") {
      throw new PrinterError("busy", "The printer is busy or already printing, so it was not started.", 409);
    }
    if (n.toLowerCase().endsWith(".gcode")) {
      return this.command({ command: "gcode_file", param: n }, `The printer started ${n}.`);
    }
    return this.command(
      {
        command: "project_file", param: `Metadata/plate_${options.plate ?? 1}.gcode`, project_id: "0", profile_id: "0", task_id: "0", subtask_id: "0",
        subtask_name: n.replace(/\.gcode\.3mf$|\.3mf$/i, ""), file: n, url: `ftp:///${n}`, md5: "",
        timelapse: options.timelapse ?? false, bed_type: "auto", bed_levelling: true, flow_cali: true, vibration_cali: true, layer_inspect: true,
        ams_mapping: options.amsMapping ?? "", use_ams: options.useAms ?? false,
      },
      `The printer started ${n}.`
    );
  }
  pause = () => this.command({ command: "pause", param: "" }, "The printer paused the print.");
  resume = () => this.command({ command: "resume", param: "" }, "The printer resumed the print.");
  cancel = () => this.command({ command: "stop", param: "" }, "The printer stopped the print.");

  async close(): Promise<void> {
    for (const s of [...pool.values()]) if (s.key.startsWith(`${this.host}:${this.mqttPort}|${this.serial}|`)) dropSession(s);
  }
}
