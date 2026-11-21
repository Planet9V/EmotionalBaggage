// Stand-in for a Bambu Lab printer's LAN side: an MQTT broker over TLS (the real port is 8883) and an implicit-FTPS server (990),
// both on random free ports on 127.0.0.1, with a self-signed certificate made by openssl for the run, as the real printer's is
// self-signed too. The broker is aedes, the file server is ftp-srv, both dev dependencies.
//
// What it is written from (read 21 Nov 2026): Bambu's wiki pages on Developer Mode and third-party integration, and the community
// protocol notes https://github.com/Doridian/OpenBambuAPI (mqtt.md, ftp.md, tls.md):
//   [BB-MQTT] user "bblp", password = access code, topics device/<serial>/report (printer to client) and device/<serial>/request;
//             {"pushing":{"sequence_id","command":"pushall"}} asks for a full report; print commands are {"print":{"sequence_id",
//             "command":"pause"|"resume"|"stop"|"project_file"|"gcode_file", ...}}.
//   [BB-FTP]  implicit TLS on port 990, user "bblp", the same access code.
//
// UNVERIFIED, chosen by this stand-in (there is no real printer in this environment; nothing here proves how a real one behaves):
//   - the acknowledgement of a command: {"print":{"command","sequence_id","result":"success","reason":"success"}}; a real printer's
//     acknowledgement was not seen. With developerMode off the stand-in answers result "fail" and the reason "mqtt message verify
//     failed" so that the adapter's refusal path can be exercised; that wording is the stand-in's.
//   - the gcode_state values (IDLE, RUNNING, PAUSE, FINISH, FAILED) and the field names mc_percent, mc_remaining_time (minutes),
//     nozzle_temper, bed_temper and so on, which are community-sourced.
//   - how a real printer treats a wrong serial number: here the subscription is refused.
//   - partial pushes: with partial on, changes after the first full report are pushed as only the changed keys, as the community
//     notes say P1 and A1 printers do.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer as tlsServer, type Server as TlsServer } from "node:tls";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Aedes } from "aedes";
import { FtpSrv } from "ftp-srv";

// Every stand-in adds signal listeners through ftp-srv; the tests run a dozen at once.
process.setMaxListeners(Math.max(process.getMaxListeners(), 60));

export type BambuStandInOptions = {
  serial: string;
  accessCode: string;
  /** false: print commands are refused, as when Developer Mode is off [unverified wording] */
  developerMode: boolean;
  /** true: the broker accepts the connection but never answers a pushall */
  silent: boolean;
  /** true: commands are accepted but never acknowledged */
  mute: boolean;
  /** true: later changes are pushed as changed keys only */
  partial: boolean;
};

export type Recorded = { kind: "connect" | "refused" | "subscribe" | "message" | "ftp-login" | "ftp-refused" | "ftp-upload"; detail: Record<string, unknown> };

let certDir: string | null = null;
function certificate() {
  if (!certDir) {
    certDir = mkdtempSync(join(tmpdir(), "c2r-bambu-cert-"));
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(certDir, "k.pem"), "-out", join(certDir, "c.pem"), "-days", "2", "-subj", "/CN=bambu-stand-in"], { stdio: "ignore" });
  }
  return { key: readFileSync(join(certDir, "k.pem")), cert: readFileSync(join(certDir, "c.pem")) };
}

export async function start(options?: Partial<BambuStandInOptions>) {
  const opts: BambuStandInOptions = { serial: "01P00A000000001", accessCode: "12345678", developerMode: true, silent: false, mute: false, partial: false, ...(options ?? {}) };
  const events: Recorded[] = [];
  const commands: Record<string, unknown>[] = [];
  const tls = certificate();
  const root = mkdtempSync(join(tmpdir(), "c2r-bambu-ftp-"));

  const state: Record<string, unknown> = {
    gcode_state: "IDLE", mc_percent: 0, mc_remaining_time: 0, subtask_name: "", gcode_file: "",
    nozzle_temper: 24.5, nozzle_target_temper: 0, bed_temper: 23.8, bed_target_temper: 0, chamber_temper: 25, print_error: 0,
  };
  let sentFull = false;

  const broker = await Aedes.createBroker();
  broker.authenticate = (client, username, password, done) => {
    const ok = username === "bblp" && password?.toString() === opts.accessCode;
    events.push({ kind: ok ? "connect" : "refused", detail: { clientId: client.id, user: username } });
    if (ok) done(null, true);
    else done(Object.assign(new Error("bad user name or password"), { returnCode: 4 }) as never, false);
  };
  broker.authorizeSubscribe = (_client, sub, cb) => {
    const ok = sub.topic === `device/${opts.serial}/report`;
    events.push({ kind: "subscribe", detail: { topic: sub.topic, granted: ok } });
    cb(null, ok ? sub : null);
  };
  const report = (print: Record<string, unknown>) => {
    broker.publish({ cmd: "publish", topic: `device/${opts.serial}/report`, payload: Buffer.from(JSON.stringify({ print })), qos: 0, retain: false, dup: false }, () => undefined);
  };
  const push = (changed?: Record<string, unknown>) => {
    if (opts.partial && sentFull && changed) report({ command: "push_status", msg: 1, sequence_id: "0", ...changed });
    else {
      report({ command: "push_status", msg: 0, sequence_id: "0", ...state });
      sentFull = true;
    }
  };
  const change = (patch: Record<string, unknown>) => {
    Object.assign(state, patch);
    push(patch);
  };

  broker.on("publish", (packet) => {
    if (packet.topic !== `device/${opts.serial}/request`) return;
    let body: Record<string, Record<string, unknown>>;
    try {
      body = JSON.parse(packet.payload.toString("utf8")) as Record<string, Record<string, unknown>>;
    } catch {
      return;
    }
    events.push({ kind: "message", detail: { topic: packet.topic, qos: packet.qos, body } });
    if (body.pushing?.command === "pushall") {
      if (!opts.silent) push();
      return;
    }
    const p = body.print;
    if (!p) return;
    commands.push(p);
    const ack = (result: "success" | "fail", reason: string) => {
      if (!opts.mute) report({ command: p.command, sequence_id: p.sequence_id, result, reason });
    };
    if (!opts.developerMode) return ack("fail", "mqtt message verify failed");
    switch (p.command) {
      case "pause":
        change({ gcode_state: "PAUSE" });
        return ack("success", "success");
      case "resume":
        change({ gcode_state: "RUNNING" });
        return ack("success", "success");
      case "stop":
        change({ gcode_state: "IDLE", mc_percent: 0, mc_remaining_time: 0, nozzle_target_temper: 0, bed_target_temper: 0 });
        return ack("success", "success");
      case "project_file":
      case "gcode_file":
        change({
          gcode_state: "RUNNING", mc_percent: 3, mc_remaining_time: 45, nozzle_target_temper: 220, bed_target_temper: 60,
          subtask_name: String(p.subtask_name ?? p.param ?? ""), gcode_file: String(p.file ?? p.param ?? ""),
        });
        return ack("success", "success");
      default:
        return ack("fail", "unknown command");
    }
  });

  const mqttServer: TlsServer = tlsServer({ key: tls.key, cert: tls.cert }, (socket) => {
    socket.on("error", () => undefined);
    broker.handle(socket);
  });
  await new Promise<void>((r) => mqttServer.listen(0, "127.0.0.1", r));
  const mqttPort = (mqttServer.address() as AddressInfo).port;

  // ftp-srv adds a listener for each of these signals per server and never removes it; take back the ones this server added.
  const SIGNALS = ["SIGTERM", "SIGINT", "SIGQUIT"] as const;
  const listenersBefore = Object.fromEntries(SIGNALS.map((sig) => [sig, new Set(process.listeners(sig))]));
  const base = 41000 + Math.floor(Math.random() * 15000);
  const ftp = new FtpSrv({ url: "ftps://127.0.0.1:0", tls: { key: tls.key, cert: tls.cert }, pasv_url: "127.0.0.1", pasv_min: base, pasv_max: base + 200, anonymous: false, log: silentLog() });
  ftp.on("login", ({ username, password }: { username: string; password: string }, resolve: (c: { root: string }) => void, reject: (e: Error) => void) => {
    if (username === "bblp" && password === opts.accessCode) {
      events.push({ kind: "ftp-login", detail: { user: username } });
      resolve({ root });
    } else {
      events.push({ kind: "ftp-refused", detail: { user: username } });
      reject(new Error("530 Login incorrect"));
    }
  });
  const ftpPort = await listenFtp(ftp);

  const uploads = () => readdirSync(root).map((n) => ({ name: n, size: statSync(join(root, n)).size }));

  return {
    host: "127.0.0.1",
    mqttPort,
    ftpPort,
    get serial() {
      return opts.serial;
    },
    get accessCode() {
      return opts.accessCode;
    },
    events,
    /** every print command received, in order */
    commands,
    /** files stored by FTPS */
    uploads,
    readUpload: (name: string) => readFileSync(join(root, name)),
    /** change what the printer reports; with partial on, only these keys are pushed */
    setState: (patch: Record<string, unknown>) => change(patch),
    set: (next: Partial<BambuStandInOptions>) => {
      Object.assign(opts, next);
    },
    async close() {
      ftp.close();
      for (const sig of SIGNALS) for (const l of process.listeners(sig)) if (!listenersBefore[sig].has(l)) process.off(sig, l);
      await new Promise<void>((r) => broker.close(() => r()));
      mqttServer.close();
      (mqttServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function silentLog() {
  const noop = () => undefined;
  const l = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop, child: () => l, level: noop };
  return l;
}

async function listenFtp(ftp: FtpSrv): Promise<number> {
  // ftp-srv binds the port in its url; port 0 is not supported by its listen(), so pick a free one first.
  const { createServer } = await import("node:net");
  for (let i = 0; i < 20; i++) {
    const port = await new Promise<number>((resolve, reject) => {
      const s = createServer();
      s.once("error", reject);
      s.listen(0, "127.0.0.1", () => {
        const p = (s.address() as AddressInfo).port;
        s.close(() => resolve(p));
      });
    });
    (ftp as unknown as { url: { port: string; host: string; hostname: string } }).url.port = String(port);
    try {
      await ftp.listen();
      return port;
    } catch {
      // port taken in between; try another
    }
  }
  throw new Error("no free port for the FTPS stand-in");
}
