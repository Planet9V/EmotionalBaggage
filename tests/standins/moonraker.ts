// Stand-in for Moonraker (Klipper's API server). The app's current read-only client
// (src/app/api/printer/route.ts) calls GET {PRINTER_URL}/printer/objects/query?print_stats&display_status and
// reads result.status.print_stats.state, result.status.print_stats.filename and result.status.display_status.progress.
//
// Documentation read (retrieved 20 Nov 2026):
//   [MR-INTRO]   https://moonraker.readthedocs.io/en/latest/external_api/introduction/
//                "Nearly all successful HTTP requests will return a json encoded object in the form of
//                {"result": <response data>}". The per-endpoint examples show <response data>, so every answer here is
//                wrapped in "result". Arguments may come from the query string or the body.
//   [MR-AUTH]    https://moonraker.readthedocs.io/en/latest/external_api/authorization/
//                API key in the X-Api-Key header, or a JWT as "Authorization: Bearer"; unauthorized requests get 401.
//   [MR-PRINTER] https://moonraker.readthedocs.io/en/latest/external_api/printer/
//                GET /printer/info example: state, state_message, hostname, klipper_path, python_path, process_id,
//                user_id, group_id, log_file, config_file, software_version, cpu_info.
//                GET /printer/objects/query?obj1&obj2=attr,attr: {eventtime, status: {<object>: {...}}}; objects or
//                attributes that do not exist are omitted, no error.
//   [MR-OBJECTS] https://moonraker.readthedocs.io/en/latest/printer_objects/
//                print_stats: filename, total_duration, print_duration, filament_used, state (standby, printing,
//                paused, complete, error, cancelled), message, info {total_layer, current_layer}.
//                display_status: message, progress.
//   [MR-FILES]   https://moonraker.readthedocs.io/en/latest/external_api/file_manager/
//                POST /server/files/upload, multipart "file", optional root (gcodes default, or config), path,
//                checksum, print ("true" starts the print, gcodes root only). Example response: item {path, root,
//                modified, size, permissions}, print_started, print_queued, action "create_file". 201 and a Location
//                header with the full path of the uploaded file.
//
// Unverified (chosen by the stand-in):
//   - the HTTP error body shape (the docs say a code and a message wrapped in a JSON object; the exact HTTP shape was
//     not shown, {"error":{"code","message"}} is used) and the 400 status for an upload without a file
//   - print_queued stays false; a print=true upload while printing does not start or queue the print
//   - checksum is recorded but not verified (no 422)
import { bearer, json, startStandIn, type FailureOptions, type MultipartBody } from "./core";

export type MoonrakerOptions = FailureOptions & {
  /** when set, requests must carry it as X-Api-Key (or a Bearer token) [MR-AUTH] */
  apiKey?: string;
  /** Klippy state reported by /printer/info [MR-PRINTER] */
  klippyState: string;
};

const DEFAULTS: MoonrakerOptions = { klippyState: "ready" };

const err = (code: number, message: string) => json(code, { error: { code, message } }); // shape unverified

export function start(options?: Partial<MoonrakerOptions>) {
  const stats = { filename: "", total_duration: 0, print_duration: 0, filament_used: 0, state: "standby", message: "" };
  let progress = 0;

  return startStandIn<MoonrakerOptions>(DEFAULTS, (req, o, base) => {
    if (o.apiKey !== undefined) {
      const key = (req.headers["x-api-key"] as string | undefined) ?? bearer(req.headers);
      if (key !== o.apiKey) return err(401, "Unauthorized"); // 401 [MR-AUTH]; body unverified
    }
    const route = `${req.method} ${req.path}`;

    if (route === "GET /printer/info") {
      return json(200, {
        result: {
          // [MR-INTRO] wrapper
          state: o.klippyState, // [MR-PRINTER]
          state_message: o.klippyState === "ready" ? "Printer is ready" : `Klippy is ${o.klippyState}`, // [MR-PRINTER]
          hostname: "stand-in", // [MR-PRINTER]
          klipper_path: "/home/pi/klipper", // [MR-PRINTER]
          python_path: "/home/pi/klipper/venv/bin/python", // [MR-PRINTER]
          process_id: 275124, // [MR-PRINTER]
          user_id: 1000, // [MR-PRINTER]
          group_id: 1000, // [MR-PRINTER]
          log_file: "/home/pi/printer_data/logs/klippy.log", // [MR-PRINTER]
          config_file: "/home/pi/printer_data/config/printer.cfg", // [MR-PRINTER]
          software_version: "v0.12.0-stand-in", // [MR-PRINTER]
          cpu_info: "stand-in", // [MR-PRINTER]
        },
      });
    }

    if (route === "GET /printer/objects/query") {
      const objects: Record<string, Record<string, unknown>> = {
        print_stats: { ...stats, info: { total_layer: null, current_layer: null } }, // [MR-OBJECTS]
        display_status: { message: "", progress }, // [MR-OBJECTS]
      };
      const status: Record<string, Record<string, unknown>> = {};
      for (const [name, attrs] of Object.entries(req.query)) {
        const obj = objects[name];
        if (!obj) continue; // unknown objects are omitted [MR-PRINTER]
        const wanted = attrs ? attrs.split(",").filter(Boolean) : [];
        status[name] = wanted.length ? Object.fromEntries(wanted.filter((a) => a in obj).map((a) => [a, obj[a]])) : obj; // [MR-PRINTER]
      }
      return json(200, { result: { eventtime: process.uptime(), status } }); // [MR-INTRO] wrapper, [MR-PRINTER] fields
    }

    if (route === "POST /server/files/upload") {
      const body = req.body as MultipartBody | null;
      const file = body?.kind === "multipart" ? body.files.find((f) => f.field === "file") : undefined;
      if (!file) return err(400, "No file uploaded"); // unverified
      const root = body?.fields.root || "gcodes"; // [MR-FILES]
      if (root !== "gcodes" && root !== "config") return err(400, `Invalid root ${root}`); // roots [MR-FILES]; status unverified
      const folder = (body?.fields.path ?? "").replace(/^\/+|\/+$/g, "");
      const path = folder ? `${folder}/${file.filename}` : file.filename;
      const start = body?.fields.print === "true" && root === "gcodes" && stats.state !== "printing"; // [MR-FILES]
      if (start) {
        Object.assign(stats, { filename: path, state: "printing", total_duration: 0, print_duration: 0 });
        progress = 0;
      }
      const location = `${base}/server/files/${root}/${path}`;
      return json(
        201, // [MR-FILES]
        {
          result: {
            // [MR-INTRO] wrapper
            item: {
              path, // [MR-FILES]
              root, // [MR-FILES]
              modified: Date.now() / 1000, // [MR-FILES]
              size: file.size, // [MR-FILES]
              permissions: "rw", // [MR-FILES]
            },
            print_started: start, // [MR-FILES]
            print_queued: false, // [MR-FILES]
            action: "create_file", // [MR-FILES]
          },
        },
        { location }, // [MR-FILES]
      );
    }

    return err(404, `stand-in has no route ${route}`); // unverified
  }, options);
}
