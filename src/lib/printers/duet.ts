// Duet boards running RepRapFirmware, in two modes that answer different HTTP APIs. The adapter detects which.
//   Standalone (the board's own web server), github.com/Duet3D/RepRapFirmware/wiki/HTTP-requests:
//     GET /rr_connect?password=<pw>[&sessionKey=yes]  -> {"err":0|1|2,...}; 0 ok, 1 wrong password, 2 no free session; the password "reprap" is sent when none is set
//     GET /rr_model?key=<key>&flags=<flags>            -> {"key","flags","result"}
//     GET /rr_gcode?gcode=<code>                       POST /rr_upload?name=<path>   (raw body; {"err":0|1})
//   SBC mode (Duet Software Framework, DuetWebServer), github.com/Duet3D/DuetSoftwareFramework/wiki/REST-API:
//     GET /machine/connect?password=<pw> -> {"sessionKey"}; later calls send it as X-Session-Key; 403 for a wrong password
//     GET /machine/model; POST /machine/code (raw G-code body); PUT /machine/file/<path>
// Object model keys (state.status, job.file.fileName, job.filePosition, job.timesLeft.file, heat.heaters[].current) are from the
// RepRapFirmware Object Model Documentation wiki page.
// The Duet's own protocol puts the machine password in the query of the sign-in call (rr_connect?password=, /machine/connect?password=).
// That URL goes only to the printer on the local network and is never logged, stored or returned; every sentence this adapter
// produces is scrubbed of the password.
// Pause is M25, resume M24, cancel M0 (runs cancel.g) and start is M32 <file>; these G-codes are RepRapFirmware's own.
import {
  GCODE_TYPES, PrinterError, safeFileName,
  type ActionResult, type AdapterOptions, type Capabilities, type PrinterAdapter, type PrinterFile, type PrinterState, type PrinterStatus,
  type PrinterValues, type TestOutcome, type UploadResult,
} from "./adapter";
import { HttpAdapterBase, httpSentence, num, str } from "./http";

type Mode = "standalone" | "sbc";
type Model = {
  state?: { status?: string };
  job?: { file?: { fileName?: string; size?: number }; filePosition?: number; timesLeft?: { file?: number | null } };
  heat?: { heaters?: ({ current?: number; active?: number } | null)[]; bedHeaters?: number[]; bedHeaterMapping?: number[][] };
  tools?: ({ heaters?: number[] } | null)[];
};

const STATES: Record<string, PrinterState> = {
  idle: "idle", processing: "printing", simulating: "printing", paused: "paused", pausing: "paused", resuming: "printing", cancelling: "busy",
  busy: "busy", changingTool: "printing", halted: "error", off: "error", disconnected: "error", starting: "busy", updating: "busy", held: "paused",
};

export class DuetAdapter extends HttpAdapterBase implements PrinterAdapter {
  readonly family = "duet";
  protected readonly who = "The Duet";
  readonly capabilities: Capabilities = {
    status: true, upload: true, start: true, pause: true, resume: true, cancel: true, pushedStatus: false, experimental: false,
    fileTypes: GCODE_TYPES,
    notes: ["Files go to the board's /gcodes folder.", "Standalone and single-board-computer (SBC) mode are told apart by asking the board."],
  };
  private mode: Mode | null = null;
  private sessionKey: string | null = null;
  private signedIn = false;
  constructor(v: PrinterValues, o?: AdapterOptions) {
    super(v, o);
  }
  protected secrets() {
    return [this.v.password, this.sessionKey];
  }
  // RepRapFirmware sends "reprap" when a client sends no password; a board with no password set accepts any.
  private get password() {
    return this.v.password ?? "";
  }

  /** Signs in and finds out which API this board speaks. */
  private async connect(): Promise<Mode> {
    if (this.mode && this.signedIn) return this.mode;
    const pw = encodeURIComponent(this.password);
    // SBC mode first: DuetWebServer has /machine/connect, standalone firmware does not.
    const sbc = await this.send(`/machine/connect?password=${pw}`);
    if (sbc.status === 200) {
      const j = await this.json<{ sessionKey?: string | number }>(sbc).catch(() => ({}) as { sessionKey?: string | number });
      this.sessionKey = j.sessionKey !== undefined ? String(j.sessionKey) : null;
      this.mode = "sbc";
      this.signedIn = true;
      return "sbc";
    }
    if (sbc.status === 403) {
      await sbc.arrayBuffer().catch(() => undefined);
      throw new PrinterError("refused", "The Duet (SBC mode) refused the machine password (HTTP 403). Check the password.", 403);
    }
    await sbc.arrayBuffer().catch(() => undefined);
    const rr = await this.need(await this.send(`/rr_connect?password=${pw}&sessionKey=yes`), [200]);
    const j = await this.json<{ err?: number; sessionKey?: number | string; boardType?: string }>(rr);
    if (j.err === 1) throw new PrinterError("refused", "The Duet refused the machine password. Check it, or leave it empty if none is set.", 200);
    if (j.err === 2) throw new PrinterError("busy", "The Duet has no free web session right now. Close other Duet Web Control windows and try again.", 200);
    if (j.err !== 0) throw new PrinterError("bad-response", "Something answered at that address, but not in the form RepRapFirmware's documentation describes. Check the address.");
    this.sessionKey = j.sessionKey !== undefined ? String(j.sessionKey) : null;
    this.mode = "standalone";
    this.signedIn = true;
    return "standalone";
  }

  private h(extra: Record<string, string> = {}): Record<string, string> {
    return this.sessionKey ? { "x-session-key": this.sessionKey, ...extra } : extra;
  }

  /** A call that signs in first and signs in again once if the session has expired. */
  private async call(run: (mode: Mode) => Promise<Response>, ok: number[]): Promise<Response> {
    let mode = await this.connect();
    let res = await run(mode);
    if (res.status === 403 || (mode === "standalone" && res.status === 401)) {
      await res.arrayBuffer().catch(() => undefined);
      this.signedIn = false;
      mode = await this.connect();
      res = await run(mode);
    }
    if (ok.includes(res.status)) return res;
    const s = await httpSentence(res, this.who, this.secrets());
    throw new PrinterError(s.kind, s.message, res.status);
  }

  async test(): Promise<TestOutcome> {
    return this.attempt(async () => {
      this.signedIn = false;
      const mode = await this.connect();
      const res = await this.call((m) => this.send(m === "sbc" ? "/machine/model" : "/rr_model?key=boards&flags=d2", { headers: this.h() }), [200]);
      const j = await this.json<Record<string, unknown>>(res);
      const boards = (mode === "sbc" ? (j as { boards?: { name?: string; firmwareVersion?: string }[] }).boards : (j as { result?: { name?: string; firmwareVersion?: string }[] }).result) ?? [];
      const b = Array.isArray(boards) ? boards[0] : undefined;
      return {
        ok: true,
        message: `The Duet answered in ${mode === "sbc" ? "SBC" : "standalone"} mode${b?.name ? `: ${b.name}${b.firmwareVersion ? `, firmware ${b.firmwareVersion}` : ""}` : ""}.`,
        detail: { mode, board: b?.name ?? null, firmware: b?.firmwareVersion ?? null },
      };
    });
  }

  private async model(): Promise<Model> {
    const mode = await this.connect();
    if (mode === "sbc") return this.json<Model>(await this.call(() => this.send("/machine/model", { headers: this.h() }), [200]));
    const key = async (k: string, flags: string) => {
      const r = await this.call(() => this.send(`/rr_model?key=${encodeURIComponent(k)}&flags=${flags}`, { headers: this.h() }), [200]);
      return (await this.json<{ result?: unknown }>(r)).result;
    };
    const [state, job, heat, tools] = await Promise.all([key("state", "d2"), key("job", "d4f"), key("heat", "d4o"), key("tools", "d3")]);
    return { state, job, heat, tools } as Model;
  }

  async status(): Promise<PrinterStatus> {
    const m = await this.model();
    const raw = str(m.state?.status);
    const heaters = m.heat?.heaters ?? [];
    const temp = (i: number | undefined) => {
      const h = i === undefined ? null : heaters[i];
      return h && num(h.current) !== null ? { actual: h.current!, target: num(h.active) } : undefined;
    };
    const bedIdx = m.heat?.bedHeaterMapping?.[0]?.[0] ?? m.heat?.bedHeaters?.[0];
    const toolIdx = m.tools?.[0]?.heaters?.[0];
    const temperatures: PrinterStatus["temperatures"] = {};
    const nozzle = temp(toolIdx);
    const bed = temp(bedIdx !== undefined && bedIdx >= 0 ? bedIdx : undefined);
    if (nozzle) temperatures.nozzle = nozzle;
    if (bed) temperatures.bed = bed;
    const size = num(m.job?.file?.size);
    const pos = num(m.job?.filePosition);
    const printing = raw === "processing" || raw === "paused" || raw === "pausing" || raw === "resuming";
    const progress = printing && size && pos !== null ? Math.min(100, Math.round((pos / size) * 1000) / 10) : null;
    return {
      state: raw ? (STATES[raw] ?? "unknown") : "unknown", rawState: raw, file: str(m.job?.file?.fileName), progress,
      secondsLeft: printing ? num(m.job?.timesLeft?.file) : null, temperatures,
    };
  }

  private async gcode(code: string): Promise<void> {
    await this.call(
      (mode) =>
        mode === "sbc"
          ? this.send("/machine/code", { method: "POST", headers: this.h({ "content-type": "text/plain" }), body: code })
          : this.send(`/rr_gcode?gcode=${encodeURIComponent(code)}`, { headers: this.h() }),
      [200]
    );
  }

  async upload(file: PrinterFile, name: string): Promise<UploadResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    const res = await this.call(
      (mode) =>
        mode === "sbc"
          ? this.send(`/machine/file/gcodes/${encodeURIComponent(n)}`, { method: "PUT", headers: this.h({ "content-type": "application/octet-stream" }), body: file.data as BodyInit }, Math.max(this.ms, 60_000))
          : this.send(`/rr_upload?name=${encodeURIComponent(`/gcodes/${n}`)}`, { method: "POST", headers: this.h({ "content-type": "application/octet-stream" }), body: file.data as BodyInit }, Math.max(this.ms, 60_000)),
      [200, 201]
    );
    if (this.mode === "standalone") {
      const j = await this.json<{ err?: number }>(res);
      if (j.err !== 0) throw new PrinterError("failed", "The Duet could not store the file (it may be out of space or the SD card is missing).");
    } else await res.arrayBuffer().catch(() => undefined);
    return { name: n, message: `The Duet stored ${n} in /gcodes. It has not been started.` };
  }

  private async ensureIdle(): Promise<void> {
    const s = await this.status();
    if (s.state === "printing" || s.state === "paused" || s.state === "busy") throw new PrinterError("busy", "The Duet is busy or already printing, so it was not started.", 409);
    if (s.state === "error") throw new PrinterError("busy", "The Duet is halted or off, so it was not started.", 409);
  }
  async start(name: string): Promise<ActionResult> {
    const n = safeFileName(name, this.capabilities.fileTypes);
    await this.ensureIdle();
    await this.gcode(`M32 "${n}"`);
    return { ok: true, message: `The Duet started ${n}.` };
  }
  private async need2(states: string[], what: string) {
    const s = await this.status();
    if (!states.includes(s.state)) throw new PrinterError("busy", `The Duet is not ${what}, so there is nothing to change.`, 409);
  }
  async pause(): Promise<ActionResult> {
    await this.need2(["printing"], "printing");
    await this.gcode("M25");
    return { ok: true, message: "The Duet paused the print." };
  }
  async resume(): Promise<ActionResult> {
    await this.need2(["paused"], "paused");
    await this.gcode("M24");
    return { ok: true, message: "The Duet resumed the print." };
  }
  async cancel(): Promise<ActionResult> {
    await this.need2(["printing", "paused"], "printing or paused");
    await this.gcode("M0");
    return { ok: true, message: "The Duet cancelled the print." };
  }
}
