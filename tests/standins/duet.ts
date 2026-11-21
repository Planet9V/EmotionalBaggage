// Stand-in for a Duet board running RepRapFirmware, in both modes the adapter has to tell apart.
//
// Documentation read (retrieved 20 Nov 2026):
//   [RRF-HTTP]  https://github.com/Duet3D/RepRapFirmware/wiki/HTTP-requests (raw wiki page)
//               Standalone: GET /rr_connect?password= -> {"err":0|1|2,"sessionTimeout","boardType"}; err 1 is a wrong password, 2 no free
//               session. GET /rr_model?key=&flags=, GET /rr_gcode?gcode=, POST /rr_upload?name=.
//   [DSF-REST]  https://github.com/Duet3D/DuetSoftwareFramework/wiki/REST-API
//               SBC mode: GET /machine/connect?password= -> {"sessionKey"}; 403 for a wrong password; later calls carry X-Session-Key;
//               GET /machine/model, POST /machine/code, PUT /machine/file/<path>.
//   [RRF-OM]    the Object Model Documentation wiki page: state.status, job.file.fileName, job.filePosition, job.timesLeft.file,
//               heat.heaters[].current and .active.
// Unverified (chosen by the stand-in): the session key value, the status after a command (it changes at once, a board takes a moment),
// the 404 answer of the other mode's endpoints, and the board name.
import { json, startStandIn, type FailureOptions } from "./core";

export type DuetOptions = FailureOptions & {
  mode: "standalone" | "sbc";
  /** the machine password; the empty string means none is set */
  password: string;
};

const DEFAULTS: DuetOptions = { mode: "standalone", password: "duet-pass-1234" };

export async function start(options?: Partial<DuetOptions>) {
  let status: "idle" | "processing" | "paused" = "idle";
  let file = "";
  const sessions = new Set<string>();
  let counter = 0;
  const stored = new Map<string, number>();

  const model = () => ({
    state: { status },
    job: { file: { fileName: status === "idle" ? null : `0:/gcodes/${file}`, size: 1000 }, filePosition: status === "idle" ? 0 : 400, timesLeft: { file: status === "idle" ? null : 900 } },
    heat: { heaters: [{ current: status === "idle" ? 23.9 : 59.8, active: status === "idle" ? 0 : 60 }, { current: status === "idle" ? 24.4 : 214.7, active: status === "idle" ? 0 : 215 }], bedHeaters: [0], bedHeaterMapping: [[0]] },
    tools: [{ heaters: [1] }],
    boards: [{ name: "Duet 3 Mini 5+ (stand-in)", firmwareVersion: "3.5.2" }],
  });

  function runGcode(code: string): number {
    const c = code.trim();
    if (c === "M25") { if (status !== "processing") return 1; status = "paused"; return 0; }
    if (c === "M24") { if (status !== "paused") return 1; status = "processing"; return 0; }
    if (c === "M0") { status = "idle"; return 0; }
    const m = /^M32\s+"?([^"]+)"?$/.exec(c);
    if (m) { if (status !== "idle") return 1; status = "processing"; file = m[1]; return 0; }
    return 0;
  }

  const si = await startStandIn<DuetOptions>(DEFAULTS, (req, o) => {
    const route = `${req.method} ${req.path}`;
    const goodKey = () => sessions.has(String(req.headers["x-session-key"] ?? ""));
    const newKey = () => {
      counter += 1;
      const k = `key-${counter}-${Math.random().toString(16).slice(2, 8)}`;
      sessions.add(k);
      return k;
    };
    const passwordOk = () => o.password === "" || (req.query.password ?? "") === o.password;

    if (o.mode === "sbc") {
      if (route === "GET /machine/connect") {
        if (!passwordOk()) return json(403, { error: "Invalid password (stand-in)" }); // [DSF-REST]
        return json(200, { sessionKey: newKey() });
      }
      if (req.path.startsWith("/machine/")) {
        if (!goodKey()) return json(403, { error: "Not signed in (stand-in)" });
        if (route === "GET /machine/model") return json(200, model());
        if (route === "POST /machine/code") {
          const bad = runGcode(String(req.body ?? ""));
          return bad ? json(500, { error: "Command refused (stand-in)" }) : { status: 200, raw: "" };
        }
        const put = /^PUT \/machine\/file\/gcodes\/(.+)$/.exec(route);
        if (put) { stored.set(decodeURIComponent(put[1]), req.rawBody.length); return json(201, {}); }
      }
      return json(404, { error: "Not found (stand-in)" });
    }

    if (route === "GET /rr_connect") {
      if (!passwordOk()) return json(200, { err: 1 }); // [RRF-HTTP]
      return json(200, { err: 0, sessionTimeout: 8000, boardType: "duet3mini5plus", sessionKey: Number(newKey().split("-")[1]) * 1000 + 7 });
    }
    if (req.path.startsWith("/rr_")) {
      // The standalone session key is a number sent back in X-Session-Key; the stand-in only needs it to be one it has issued.
      const key = String(req.headers["x-session-key"] ?? "");
      const issued = [...sessions].some((s) => String(Number(s.split("-")[1]) * 1000 + 7) === key);
      if (!issued) return json(401, { err: 1 }); // unverified status for a missing session
      if (route === "GET /rr_model") {
        const k = req.query.key ?? "";
        const m = model() as Record<string, unknown>;
        return json(200, { key: k, flags: req.query.flags ?? "", result: m[k] ?? null });
      }
      if (route === "GET /rr_gcode") {
        runGcode(req.query.gcode ?? "");
        return { status: 200, raw: "" };
      }
      if (route === "POST /rr_upload") {
        stored.set(req.query.name ?? "", req.rawBody.length);
        return json(200, { err: 0 });
      }
    }
    return json(404, { error: "Not found (stand-in)" });
  }, options);
  /** Forgets every session, as a board does after its timeout; the next call must sign in again. */
  return Object.assign(si, { forgetSessions: () => sessions.clear() });
}
