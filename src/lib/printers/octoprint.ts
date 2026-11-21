// OctoPrint, from its REST API documentation (docs.octoprint.org/en/main/api/):
//   general  : key in X-Api-Key; a missing or wrong key is answered 403
//   version  : GET /api/version
//   job      : GET /api/job; POST /api/job {"command":"start"|"cancel"|"pause","action":"pause"|"resume"}; 204; 409 when the state is wrong
//   printer  : GET /api/printer for temperatures; 409 when the printer is not operational
//   files    : POST /api/files/local multipart (file, select, print); 201
import {
  GCODE_TYPES, PrinterError, safeFileName,
  type ActionResult, type AdapterOptions, type Capabilities, type PrinterAdapter, type PrinterFile, type PrinterState, type PrinterStatus,
  type PrinterValues, type Temperature, type TestOutcome, type UploadResult,
} from "./adapter";
import { HttpAdapterBase, num, str } from "./http";

type Job = { job?: { file?: { name?: string | null } }; progress?: { completion?: number | null; printTimeLeft?: number | null }; state?: string };
type Printer = { temperature?: { tool0?: { actual?: number; target?: number | null }; bed?: { actual?: number; target?: number | null }; chamber?: { actual?: number; target?: number | null } } };

const STATES: [RegExp, PrinterState][] = [
  [/^printing/i, "printing"], [/^pausing|^paused/i, "paused"], [/^cancelling|^finishing|^starting/i, "busy"],
  [/^operational/i, "idle"], [/error|closed|offline/i, "error"],
];

export class OctoPrintAdapter extends HttpAdapterBase implements PrinterAdapter {
  readonly family = "octoprint";
  protected readonly who = "OctoPrint";
  readonly capabilities: Capabilities = {
    status: true, upload: true, start: true, pause: true, resume: true, cancel: true, pushedStatus: false, experimental: false,
    fileTypes: [...GCODE_TYPES, ".stl"], notes: ["Files go to OctoPrint's own storage (local). OctoPrint then sends them to the printer."],
  };
  constructor(v: PrinterValues, o?: AdapterOptions) {
    super(v, o);
  }
  protected secrets() {
    return [this.v.apiKey];
  }
  private headers(extra: Record<string, string> = {}) {
    return { "x-api-key": this.v.apiKey ?? "", ...extra };
  }

  async test(): Promise<TestOutcome> {
    return this.attempt(async () => {
      const res = await this.need(await this.send("/api/version", { headers: this.headers() }), [200]);
      const j = await this.json<{ server?: string; text?: string; api?: string }>(res);
      return { ok: true, message: `OctoPrint answered: ${j?.text ?? `server ${j?.server ?? "unknown"}`}.`, detail: { server: j?.server ?? null, api: j?.api ?? null } };
    });
  }

  async status(): Promise<PrinterStatus> {
    const job = await this.json<Job>(await this.need(await this.send("/api/job", { headers: this.headers() }), [200]));
    const raw = str(job.state);
    const state = raw ? (STATES.find(([re]) => re.test(raw))?.[1] ?? "unknown") : "unknown";
    const temperatures: PrinterStatus["temperatures"] = {};
    // /api/printer answers 409 when the printer is not operational; that is not a failure of the status call.
    const p = await this.send("/api/printer", { headers: this.headers() });
    if (p.status === 200) {
      const t = (await this.json<Printer>(p)).temperature ?? {};
      const temp = (x?: { actual?: number; target?: number | null }): Temperature | undefined => (num(x?.actual) !== null ? { actual: x!.actual!, target: num(x?.target) } : undefined);
      Object.assign(temperatures, { nozzle: temp(t.tool0), bed: temp(t.bed), chamber: temp(t.chamber) });
      for (const k of Object.keys(temperatures) as (keyof typeof temperatures)[]) if (!temperatures[k]) delete temperatures[k];
    } else if (p.status !== 409) {
      await this.need(p, [200, 409]);
    }
    return {
      state, rawState: raw, file: str(job.job?.file?.name), progress: num(job.progress?.completion),
      secondsLeft: num(job.progress?.printTimeLeft), temperatures,
    };
  }

  async upload(file: PrinterFile, name: string): Promise<UploadResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    const form = new FormData();
    form.append("file", new Blob([file.data as BlobPart], { type: file.contentType ?? "application/octet-stream" }), n);
    // No select and no print: sending a file never starts the printer.
    const res = await this.need(await this.send("/api/files/local", { method: "POST", headers: this.headers(), body: form }, Math.max(this.ms, 60_000)), [201]);
    await res.text();
    return { name: n, message: `OctoPrint stored ${n}. It has not been started.` };
  }

  private async command(body: Record<string, string>, said: string): Promise<ActionResult> {
    const res = await this.send("/api/job", { method: "POST", headers: this.headers({ "content-type": "application/json" }), body: JSON.stringify(body) });
    await this.need(res, [204]);
    return { ok: true, message: said };
  }

  async start(name: string): Promise<ActionResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    // OctoPrint starts the file that is selected, so select it first (POST /api/files/local/<path>, command "select"; 204).
    const sel = await this.send(`/api/files/local/${encodeURIComponent(n)}`, {
      method: "POST", headers: this.headers({ "content-type": "application/json" }), body: JSON.stringify({ command: "select", print: false }),
    });
    if (sel.status === 409) throw new PrinterError("busy", "OctoPrint cannot select a file now: a print is running or the printer is not operational.", 409);
    await this.need(sel, [200, 204]);
    return this.command({ command: "start" }, `OctoPrint started ${n}.`);
  }
  pause = () => this.command({ command: "pause", action: "pause" }, "OctoPrint paused the print.");
  resume = () => this.command({ command: "pause", action: "resume" }, "OctoPrint resumed the print.");
  cancel = () => this.command({ command: "cancel" }, "OctoPrint cancelled the print.");
}
