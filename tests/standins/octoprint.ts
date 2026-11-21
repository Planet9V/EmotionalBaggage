// Stand-in for OctoPrint's REST API. The app's current read-only client (src/app/api/printer/route.ts)
// calls GET {PRINTER_URL}/api/job with X-Api-Key and reads state, job.file.name, progress.completion and
// progress.printTimeLeft.
//
// Documentation read (retrieved 20 Nov 2026, from the reStructuredText sources of the pages named in the plan):
//   [OP-GENERAL] https://docs.octoprint.org/en/main/api/general.html  (_sources/api/general.rst.txt)
//                The key goes in "X-Api-Key" or "Authorization: Bearer"; a missing or invalid key makes the request
//                anonymous and "will be denied with a 403". So a wrong key answers 403 here, not 401.
//   [OP-VERSION] https://docs.octoprint.org/en/main/api/version.html (_sources/api/version.rst.txt)
//                API 2.0.0+: {"server": "2.0.0", "text": "OctoPrint 2.0.0"}.
//   [OP-JOB]     https://docs.octoprint.org/en/main/api/job.html  (_sources/api/job.rst.txt)
//                GET /api/job example: job.file {name, origin, size, date}, job.estimatedPrintTime, job.filament.tool0
//                {length, volume}, job.user, progress {completion, filepos, printTime, printTimeLeft,
//                printTimeLeftOrigin}, state "Printing". POST /api/job {"command":"start"} answers 204 with an empty body;
//                409 if a job is already active; "cancel" answers 409 if no job is active.
//   [OP-FILES]   https://docs.octoprint.org/en/main/api/files.html  (_sources/api/files.rst.txt)
//                POST /api/files/{storage}, storage "local" or "printer", multipart with "file" and optional "path",
//                "select", "print" ("print" implies "select"; neither has effect if the printer is not operational and
//                the effective* field is then false). 201 with a Location header and {file {name, path, origin, refs
//                {resource, download}}, done, effectiveSelect, effectivePrint}. 400 without file or foldername, 404 for
//                an unknown storage, 409 when overwriting the file being printed, 415 if not gcode or stl.
//
//   [OP-PRINTER] https://docs.octoprint.org/en/main/api/printer.html  GET /api/printer: temperature {tool0 {actual, target, offset}, bed {...}};
//                409 "if the printer is not operational".
//   [OP-FILECMD] files.html "Issue a file command": POST /api/files/{location}/{path} {"command":"select","print":false}: 204; 409 if a job is active.
//   [OP-PAUSE]   job.html: {"command":"pause","action":"pause"|"resume"|"toggle"}; 409 if no job is active (printing or paused).
//
// Unverified (chosen by the stand-in, not read in the docs):
//   - the idle state string "Operational" and the job/progress values when no file is selected (null fields)
//   - the 400 answer for an unknown job command, and the error bodies of every non-2xx answer
//   - the gcode file extensions accepted (".gcode", ".gco", ".g") besides ".stl"
//   - folder creation via "foldername" is not implemented (answers 400 as if no file were sent)
import { bearer, json, startStandIn, type FailureOptions, type MultipartBody } from "./core";

export type OctoPrintOptions = FailureOptions & {
  /** when set, requests must carry it as X-Api-Key or Bearer [OP-GENERAL] */
  apiKey?: string;
  /** status for a missing or wrong key; the docs say 403 [OP-GENERAL] */
  authFailureStatus: number;
  /** false makes select/print ineffective, as for a printer that is not operational [OP-FILES] */
  operational: boolean;
  /** server version reported by GET /api/version */
  serverVersion: string;
};

const DEFAULTS: OctoPrintOptions = { authFailureStatus: 403, operational: true, serverVersion: "2.0.0" };

type FileInfo = { name: string; origin: string; size: number; date: number };

export function start(options?: Partial<OctoPrintOptions>) {
  let selected: FileInfo | null = null;
  let printing = false;
  let paused = false;
  const files = new Map<string, FileInfo>();

  return startStandIn<OctoPrintOptions>(DEFAULTS, (req, o, base) => {
    if (o.apiKey !== undefined) {
      const key = (req.headers["x-api-key"] as string | undefined) ?? bearer(req.headers);
      if (key !== o.apiKey) return json(o.authFailureStatus, { error: "You don't have the permission to access the requested resource (stand-in)" }); // body unverified
    }
    const route = `${req.method} ${req.path}`;

    if (route === "GET /api/version") {
      return json(200, { server: o.serverVersion, text: `OctoPrint ${o.serverVersion}` }); // [OP-VERSION]
    }

    if (route === "GET /api/job") {
      return json(200, {
        job: {
          file: selected
            ? { name: selected.name, origin: selected.origin, size: selected.size, date: selected.date } // [OP-JOB]
            : { name: null, origin: null, size: null, date: null }, // unverified (no file selected)
          estimatedPrintTime: selected ? 8811 : null, // [OP-JOB] (value from the example)
          filament: selected ? { tool0: { length: 810, volume: 5.36 } } : null, // [OP-JOB] (value from the example)
          user: selected ? "stand-in" : null, // [OP-JOB]
        },
        progress: printing || paused
          ? { completion: 0.2298468264184775, filepos: 337942, printTime: 276, printTimeLeft: 912, printTimeLeftOrigin: "linear" } // [OP-JOB] fields; values from the example
          : { completion: null, filepos: null, printTime: null, printTimeLeft: null, printTimeLeftOrigin: null }, // unverified (idle)
        state: paused ? "Paused" : printing ? "Printing" : "Operational", // "Printing" [OP-JOB]; "Operational" and "Paused" unverified
      });
    }

    if (route === "GET /api/printer") {
      if (!o.operational) return json(409, { error: "Printer is not operational (stand-in)" }); // 409 [OP-PRINTER]
      return json(200, {
        temperature: {
          tool0: { actual: printing ? 214.9 : 24.1, target: printing ? 215 : 0, offset: 0 }, // [OP-PRINTER] shape; values invented
          bed: { actual: printing ? 59.5 : 23.4, target: printing ? 60 : 0, offset: 0 },
        },
      });
    }

    if (route === "POST /api/job") {
      const body = req.body as { command?: string; action?: string } | null;
      const command = body?.command;
      if (command === "start") {
        if (printing || paused || !selected || !o.operational) return json(409, { error: "Printer is not operational or already printing (stand-in)" }); // 409 [OP-JOB]; body unverified
        printing = true;
        return { status: 204 }; // [OP-JOB]
      }
      if (command === "cancel") {
        if (!printing && !paused) return json(409, { error: "No job is active (stand-in)" }); // 409 [OP-JOB]; body unverified
        printing = false;
        paused = false;
        return { status: 204 }; // [OP-JOB]
      }
      if (command === "pause") {
        if (!printing && !paused) return json(409, { error: "No job is active (stand-in)" }); // 409 [OP-PAUSE]
        const action = body?.action ?? "toggle"; // [OP-PAUSE]
        const wantPause = action === "pause" ? true : action === "resume" ? false : printing; // toggle flips
        printing = !wantPause;
        paused = wantPause;
        return { status: 204 }; // [OP-PAUSE]
      }
      return json(400, { error: `Unknown command ${String(command)} (stand-in)` }); // unverified
    }

    const fileCmd = /^\/api\/files\/([^/]+)\/(.+)$/.exec(req.path);
    if (req.method === "POST" && fileCmd) {
      const command = (req.body as { command?: string; print?: boolean } | null)?.command;
      const path = decodeURIComponent(fileCmd[2]);
      const found = files.get(`${fileCmd[1]}/${path}`);
      if (!found) return json(404, { error: "No such file (stand-in)" }); // unverified
      if (command !== "select") return json(400, { error: `Unknown file command ${String(command)} (stand-in)` }); // unverified
      if (printing || paused) return json(409, { error: "A job is active (stand-in)" }); // 409 [OP-FILECMD]
      selected = found;
      return { status: 204 }; // [OP-FILECMD]
    }

    const upload = /^\/api\/files\/([^/]+)$/.exec(req.path);
    if (req.method === "POST" && upload) {
      const storage = upload[1];
      if (storage !== "local" && storage !== "printer") return json(404, { error: `Unknown storage ${storage} (stand-in)` }); // 404 [OP-FILES]
      const body = req.body as MultipartBody | null;
      const file = body?.kind === "multipart" ? body.files.find((f) => f.field === "file") : undefined;
      if (!file) return json(400, { error: "No file to upload (stand-in)" }); // 400 [OP-FILES]
      if (!/\.(gcode|gco|g|stl)$/i.test(file.filename)) return json(415, { error: "Not a gcode or stl file (stand-in)" }); // 415 [OP-FILES]; extension list unverified
      const folder = (body?.fields.path ?? "").replace(/^\/+|\/+$/g, "");
      const path = folder ? `${folder}/${file.filename}` : file.filename;
      if ((printing || paused) && selected?.name === path) return json(409, { error: "File is being printed (stand-in)" }); // 409 [OP-FILES]
      const info: FileInfo = { name: path, origin: storage, size: file.size, date: Math.floor(Date.now() / 1000) };
      files.set(`${storage}/${path}`, info);
      const wantPrint = body?.fields.print === "true";
      const wantSelect = wantPrint || body?.fields.select === "true"; // print implies select [OP-FILES]
      const effectiveSelect = wantSelect && o.operational && !printing; // [OP-FILES]
      const effectivePrint = wantPrint && o.operational && !printing; // [OP-FILES]
      if (effectiveSelect) selected = info;
      if (effectivePrint) printing = true;
      const resource = `${base}/api/files/${storage}/${path}`;
      return json(
        201, // [OP-FILES]
        {
          file: {
            name: file.filename, // [OP-FILES]
            path, // [OP-FILES]
            origin: storage, // [OP-FILES]
            refs: { resource, download: `${base}/downloads/files/${storage}/${path}` }, // [OP-FILES]
          },
          done: true, // [OP-FILES]
          effectiveSelect, // [OP-FILES]
          effectivePrint, // [OP-FILES]
        },
        { location: resource }, // [OP-FILES]
      );
    }

    return json(404, { error: `stand-in has no route ${route}` }); // unverified
  }, options);
}
