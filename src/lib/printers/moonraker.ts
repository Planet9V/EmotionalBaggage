// Moonraker (Klipper's API server), from moonraker.readthedocs.io/en/latest/external_api/:
//   authorization: optional API key in X-Api-Key; unauthorized requests get 401
//   printer      : GET /printer/info; GET /printer/objects/query?obj&obj=attr,attr; POST /printer/print/start?filename=, /pause, /resume, /cancel (answer "ok")
//   file_manager : POST /server/files/upload multipart (file, root, path, print); 201
//   printer_objects: print_stats {state, filename, print_duration}, display_status {progress}, virtual_sdcard {progress}, extruder/heater_bed {temperature, target}
// Also drives Creality K1-series and other Klipper machines that expose Moonraker (experimental there; see models.ts).
import {
  GCODE_TYPES, PrinterError, safeFileName,
  type ActionResult, type AdapterOptions, type Capabilities, type PrinterAdapter, type PrinterFile, type PrinterState, type PrinterStatus,
  type PrinterValues, type TestOutcome, type UploadResult,
} from "./adapter";
import { HttpAdapterBase, num, str } from "./http";

type Objects = {
  print_stats?: { state?: string; filename?: string; print_duration?: number; message?: string };
  display_status?: { progress?: number };
  virtual_sdcard?: { progress?: number };
  extruder?: { temperature?: number; target?: number };
  heater_bed?: { temperature?: number; target?: number };
};

const STATES: Record<string, PrinterState> = { standby: "idle", printing: "printing", paused: "paused", complete: "finished", error: "error", cancelled: "idle" };

export class MoonrakerAdapter extends HttpAdapterBase implements PrinterAdapter {
  readonly family: string;
  protected readonly who = "Moonraker";
  readonly capabilities: Capabilities;
  constructor(v: PrinterValues, o?: AdapterOptions & { experimental?: boolean; family?: string }) {
    super(v, o);
    this.family = o?.family ?? "moonraker";
    this.capabilities = {
      status: true, upload: true, start: true, pause: true, resume: true, cancel: true, pushedStatus: false, experimental: !!o?.experimental,
      fileTypes: GCODE_TYPES,
      notes: ["Files go to the gcodes folder of the printer's Moonraker.", "Time left is worked out from elapsed time and progress, because Moonraker does not report it."],
    };
  }
  protected secrets() {
    return [this.v.apiKey];
  }
  private headers(extra: Record<string, string> = {}) {
    return this.v.apiKey ? { "x-api-key": this.v.apiKey, ...extra } : extra;
  }

  async test(): Promise<TestOutcome> {
    return this.attempt(async () => {
      const res = await this.need(await this.send("/printer/info", { headers: this.headers() }), [200]);
      const j = await this.json<{ result?: { state?: string; software_version?: string; hostname?: string } }>(res);
      const state = j?.result?.state ?? "unknown";
      return {
        ok: true, message: `Moonraker answered; Klipper is ${state}.`,
        detail: { state, softwareVersion: j?.result?.software_version ?? null, hostname: j?.result?.hostname ?? null },
      };
    });
  }

  async status(): Promise<PrinterStatus> {
    const res = await this.need(
      await this.send("/printer/objects/query?print_stats&display_status&virtual_sdcard&extruder&heater_bed", { headers: this.headers() }),
      [200]
    );
    const j = await this.json<{ result?: { status?: Objects } }>(res);
    const s = j.result?.status ?? {};
    const raw = str(s.print_stats?.state);
    const progress = num(s.display_status?.progress) ?? num(s.virtual_sdcard?.progress);
    const pct = progress === null ? null : Math.round(progress * 1000) / 10;
    const elapsed = num(s.print_stats?.print_duration);
    const left = pct !== null && pct > 0 && pct < 100 && elapsed !== null && elapsed > 0 ? Math.round((elapsed * (100 - pct)) / pct) : null;
    const temperatures: PrinterStatus["temperatures"] = {};
    if (num(s.extruder?.temperature) !== null) temperatures.nozzle = { actual: s.extruder!.temperature!, target: num(s.extruder?.target) };
    if (num(s.heater_bed?.temperature) !== null) temperatures.bed = { actual: s.heater_bed!.temperature!, target: num(s.heater_bed?.target) };
    return {
      state: raw ? (STATES[raw] ?? "unknown") : "unknown", rawState: raw, file: str(s.print_stats?.filename), progress: pct,
      secondsLeft: left, secondsLeftEstimated: left !== null ? true : undefined, temperatures,
      ...(str(s.print_stats?.message) ? { message: str(s.print_stats?.message)! } : {}),
    };
  }

  async upload(file: PrinterFile, name: string): Promise<UploadResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    const form = new FormData();
    form.append("file", new Blob([file.data as BlobPart], { type: file.contentType ?? "application/octet-stream" }), n);
    form.append("root", "gcodes");
    // print is not sent: sending a file never starts the printer.
    const res = await this.need(await this.send("/server/files/upload", { method: "POST", headers: this.headers(), body: form }, Math.max(this.ms, 60_000)), [201]);
    await res.text();
    return { name: n, message: `Moonraker stored ${n} in the gcodes folder. It has not been started.` };
  }

  private async post(path: string, said: string): Promise<ActionResult> {
    const res = await this.send(path, { method: "POST", headers: this.headers() });
    if (res.status === 400 || res.status === 409) {
      throw new PrinterError("busy", "Klipper refused: the printer is not in a state that allows that (it may be printing already, paused, or in an error).", res.status);
    }
    await this.need(res, [200]);
    return { ok: true, message: said };
  }
  async start(name: string): Promise<ActionResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    return this.post(`/printer/print/start?filename=${encodeURIComponent(n)}`, `Moonraker started ${n}.`);
  }
  pause = () => this.post("/printer/print/pause", "Moonraker paused the print.");
  resume = () => this.post("/printer/print/resume", "Moonraker resumed the print.");
  cancel = () => this.post("/printer/print/cancel", "Moonraker cancelled the print.");
}
