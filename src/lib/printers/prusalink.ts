// PrusaLink, from the OpenAPI file in github.com/prusa3d/Prusa-Link-Web (spec/openapi.yaml):
//   GET /api/version, /api/v1/info, /api/v1/status (printer.state, temp_nozzle, temp_bed, job.progress, job.time_remaining, job.id), /api/v1/job, /api/v1/storage
//   PUT /api/v1/files/{storage}/{path} (octet-stream; headers Print-After-Upload, Overwrite as ?0 or ?1)   -> 201
//   POST /api/v1/files/{storage}/{path} starts a print -> 204
//   PUT /api/v1/job/{id}/pause, /resume; DELETE /api/v1/job/{id} stops the job   -> 204; 409 when the state is wrong
// Authentication, two generations (Prusa's help pages and the Home Assistant integration page):
//   - current firmware (MINI/MINI+ 5.1.0 or later, MK3.9/MK4/MK4S, XL, CORE One, CORE One L: v1 API needs 4.7.0 or later):
//     HTTP digest with a user name and password, shown at the printer under Settings, Network, PrusaLink.
//   - the Raspberry Pi PrusaLink for MK2.5/MK3 (version 0.7.0 or later): the API key in X-Api-Key.
// Home Assistant's PrusaLink page adds: on some models the user name is not shown because it is fixed to "maker", and the password
// entry may be called "API key" on the printer; it is still entered as the password. This adapter signs in with digest when a
// password is given (the user name "maker" when none is given) and with the X-Api-Key header when only a key is given.
import {
  PrinterError, safeFileName,
  type ActionResult, type AdapterOptions, type Capabilities, type PrinterAdapter, type PrinterFile, type PrinterState, type PrinterStatus,
  type PrinterValues, type TestOutcome, type UploadResult,
} from "./adapter";
import { digestHeader } from "./digest";
import { HttpAdapterBase, httpSentence, num, str } from "./http";

type Status = {
  printer?: { state?: string; temp_nozzle?: number; target_nozzle?: number; temp_bed?: number; target_bed?: number; status_printer?: { message?: string; ok?: boolean } };
  job?: { id?: number; progress?: number; time_remaining?: number };
};
type JobInfo = { id?: number; file?: { name?: string; display_name?: string } };

const STATES: Record<string, PrinterState> = {
  IDLE: "idle", READY: "idle", BUSY: "busy", PRINTING: "printing", PAUSED: "paused", FINISHED: "finished", STOPPED: "idle", ERROR: "error", ATTENTION: "error",
};

export class PrusaLinkAdapter extends HttpAdapterBase implements PrinterAdapter {
  readonly family = "prusalink";
  protected readonly who = "PrusaLink";
  readonly capabilities: Capabilities = {
    status: true, upload: true, start: true, pause: true, resume: true, cancel: true, pushedStatus: false, experimental: false,
    fileTypes: [".gcode", ".bgcode"],
    notes: [
      "The print is started with a separate, confirmed step; sending a file never starts it.",
      "An existing file with the same name on the printer is replaced.",
    ],
  };
  constructor(v: PrinterValues, o?: AdapterOptions) {
    super(v, o);
  }
  protected secrets() {
    return [this.v.password, this.v.apiKey];
  }

  /** Digest sign-in when there is a password. Some printers hide the user name because it is fixed to "maker" (Home Assistant's PrusaLink page). */
  private get digest() {
    return !!this.v.password;
  }
  private get user() {
    return this.v.username || "maker";
  }

  /** One call, signed in whichever way this printer is set up. */
  protected override async send(path: string, init: RequestInit = {}, ms = this.ms): Promise<Response> {
    const headers: Record<string, string> = { ...((init.headers as Record<string, string>) ?? {}) };
    if (this.v.apiKey) headers["x-api-key"] = this.v.apiKey;
    if (this.digest) {
      // One cheap unauthenticated call to a path that always needs the sign-in (/api/version is open on some firmware) fetches the challenge; the real call (with its body) is then sent once, already signed.
      const probe = await super.send("/api/v1/status", {}, ms);
      const challenge = probe.status === 401 ? probe.headers.get("www-authenticate") : null;
      await probe.arrayBuffer().catch(() => undefined);
      if (challenge) {
        const uri = path;
        const h = digestHeader(challenge, (init.method ?? "GET").toUpperCase(), uri, this.user, this.v.password!);
        if (h) headers.authorization = h;
      }
    }
    return super.send(path, { ...init, headers }, ms);
  }

  protected override async need(res: Response, ok: number[]): Promise<Response> {
    if (ok.includes(res.status)) return res;
    if (res.status === 401 || res.status === 403) {
      const how = this.digest ? "user name and password" : "API key";
      throw new PrinterError("refused", `PrusaLink refused the ${how} (HTTP ${res.status}). Check them at the printer: Settings, Network, PrusaLink.`, res.status);
    }
    const s = await httpSentence(res, this.who, this.secrets(), "Check the address. The v1 interface needs PrusaLink firmware 4.7.0 or later (5.1.0 or later on the MINI).");
    throw new PrinterError(s.kind, s.message, res.status);
  }

  async test(): Promise<TestOutcome> {
    return this.attempt(async () => {
      if (!this.digest && !this.v.apiKey) return { ok: false, message: "PrusaLink needs the password shown at the printer (Settings, Network, PrusaLink), with the user name if it is shown, or an API key." };
      const res = await this.need(await this.send("/api/version"), [200]);
      const j = await this.json<{ text?: string; api?: string; firmware?: string }>(res);
      // /api/version answers without a sign-in on some firmware, so the check that the sign-in works is a status call.
      await this.need(await this.send("/api/v1/status"), [200]);
      return { ok: true, message: `PrusaLink answered: ${j?.text ?? "version unknown"}.`, detail: { api: j?.api ?? null, firmware: j?.firmware ?? null } };
    });
  }

  private async getStatus(): Promise<Status> {
    return this.json<Status>(await this.need(await this.send("/api/v1/status"), [200]));
  }

  async status(): Promise<PrinterStatus> {
    const s = await this.getStatus();
    const raw = str(s.printer?.state);
    const state = raw ? (STATES[raw.toUpperCase()] ?? "unknown") : "unknown";
    let file: string | null = null;
    if (state === "printing" || state === "paused") {
      const r = await this.send("/api/v1/job");
      if (r.status === 200) {
        const j = await this.json<JobInfo>(r);
        file = str(j.file?.display_name) ?? str(j.file?.name);
      } else await r.arrayBuffer().catch(() => undefined);
    }
    const temperatures: PrinterStatus["temperatures"] = {};
    if (num(s.printer?.temp_nozzle) !== null) temperatures.nozzle = { actual: s.printer!.temp_nozzle!, target: num(s.printer?.target_nozzle) };
    if (num(s.printer?.temp_bed) !== null) temperatures.bed = { actual: s.printer!.temp_bed!, target: num(s.printer?.target_bed) };
    const message = s.printer?.status_printer && s.printer.status_printer.ok === false ? str(s.printer.status_printer.message) : null;
    return { state, rawState: raw, file, progress: num(s.job?.progress), secondsLeft: num(s.job?.time_remaining), temperatures, ...(message ? { message } : {}) };
  }

  /** The first storage that is available and writable, as the path segment the files endpoints take ("local", "usb"). */
  private async storage(): Promise<string> {
    const res = await this.need(await this.send("/api/v1/storage"), [200]);
    const j = await this.json<{ storage_list?: { path?: string; available?: boolean; read_only?: boolean }[] }>(res);
    const pick = (j.storage_list ?? []).find((x) => x.available !== false && !x.read_only && typeof x.path === "string");
    if (!pick?.path) throw new PrinterError("failed", "PrusaLink reports no storage it can write to. Insert the USB drive or check the printer's storage.");
    return pick.path.replace(/^\/+/, "");
  }

  async upload(file: PrinterFile, name: string): Promise<UploadResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    const st = await this.storage();
    const res = await this.send(
      `/api/v1/files/${st}/${encodeURIComponent(n)}`,
      { method: "PUT", headers: { "content-type": "application/octet-stream", "print-after-upload": "?0", overwrite: "?1" }, body: file.data as BodyInit },
      Math.max(this.ms, 60_000)
    );
    await this.need(res, [201]);
    return { name: n, message: `PrusaLink stored ${n} on ${st}. It has not been started.` };
  }

  async start(name: string): Promise<ActionResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    const st = await this.storage();
    const res = await this.send(`/api/v1/files/${st}/${encodeURIComponent(n)}`, { method: "POST" });
    if (res.status === 409) throw new PrinterError("busy", "PrusaLink refused to start: a print is already running or the printer is not ready.", 409);
    await this.need(res, [204]);
    return { ok: true, message: `PrusaLink started ${n}.` };
  }

  private async onJob(method: "PUT" | "DELETE", suffix: string, said: string): Promise<ActionResult> {
    const id = num((await this.getStatus()).job?.id);
    if (id === null) throw new PrinterError("busy", "PrusaLink reports no print job, so there is nothing to change.", 409);
    const res = await this.send(`/api/v1/job/${id}${suffix}`, { method });
    if (res.status === 409) throw new PrinterError("busy", "PrusaLink refused: the job is not in a state that allows that.", 409);
    await this.need(res, [204]);
    return { ok: true, message: said };
  }
  pause = () => this.onJob("PUT", "/pause", "PrusaLink paused the print.");
  resume = () => this.onJob("PUT", "/resume", "PrusaLink resumed the print.");
  cancel = () => this.onJob("DELETE", "", "PrusaLink stopped the print.");
}
