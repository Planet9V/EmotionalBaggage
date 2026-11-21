// Stand-in for PrusaLink's v1 HTTP API, as a printer with current firmware (MK4S, CORE One, XL, MINI+) answers it.
//
// Documentation read (retrieved 20 Nov 2026):
//   [PL-SPEC]  https://github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml (raw file)
//              GET /api/version, /api/v1/status, /api/v1/job, /api/v1/storage; PUT /api/v1/files/{storage}/{path} (201, headers
//              Print-After-Upload and Overwrite as ?0/?1); POST /api/v1/files/{storage}/{path} starts a print (204);
//              PUT /api/v1/job/{id}/pause and /resume, DELETE /api/v1/job/{id} (204); 409 when the state does not allow it.
//              The one security scheme named is http digest.
//   [PL-HELP]  Prusa's help page: the digest is the default and can be switched off at the printer.
//   [RFC7616]  The stand-in checks the digest response itself (MD5, qop=auth), so a wrong password is refused for the right reason.
//
// The stand-in can also be set to API-key mode (X-Api-Key), the way the Raspberry Pi PrusaLink for MK2.5 and MK3 works.
// Unverified (chosen by the stand-in): the 401 body text, the nonce and realm values ("Prusa-Link"), the printer values in /status.
import { createHash, randomBytes } from "node:crypto";
import { json, startStandIn, type FailureOptions } from "./core";

export type PrusaLinkOptions = FailureOptions & {
  /** "digest" asks for HTTP digest with user and password; "key" asks for X-Api-Key */
  auth: "digest" | "key";
  user: string;
  password: string;
  apiKey: string;
  /** false makes /api/version answer without a sign-in, as the real one does on some firmware */
  versionOpen: boolean;
  /** the storage the stand-in offers */
  storages: { path: string; available: boolean; read_only: boolean }[];
};

const DEFAULTS: PrusaLinkOptions = {
  auth: "digest", user: "maker", password: "hunter2-prusa", apiKey: "prusa-key-0000", versionOpen: true,
  storages: [{ path: "/usb", available: true, read_only: false }],
};

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export function start(options?: Partial<PrusaLinkOptions>) {
  const realm = "Prusa-Link";
  const nonces = new Set<string>();
  let state: "IDLE" | "PRINTING" | "PAUSED" = "IDLE";
  let jobId = 0;
  let current = "";
  const files = new Map<string, number>();

  function digestOk(authorization: string | undefined, method: string, o: PrusaLinkOptions): boolean {
    if (!authorization || !/^Digest\s/i.test(authorization)) return false;
    const f: Record<string, string> = {};
    for (const m of authorization.slice(7).matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]*))/g)) f[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
    if (f.username !== o.user || f.realm !== realm || !nonces.has(f.nonce)) return false;
    const ha1 = md5(`${f.username}:${realm}:${o.password}`);
    const ha2 = md5(`${method}:${f.uri}`);
    const want = f.qop === "auth" ? md5(`${ha1}:${f.nonce}:${f.nc}:${f.cnonce}:auth:${ha2}`) : md5(`${ha1}:${f.nonce}:${ha2}`);
    return want === f.response;
  }

  return startStandIn<PrusaLinkOptions>(DEFAULTS, (req, o) => {
    const open = req.path === "/api/version" && o.versionOpen;
    if (!open) {
      if (o.auth === "key") {
        if (req.headers["x-api-key"] !== o.apiKey) return json(401, { message: "Unauthorized (stand-in)" });
      } else if (!digestOk(req.headers.authorization as string | undefined, req.method, o)) {
        const nonce = randomBytes(8).toString("hex");
        nonces.add(nonce);
        return { status: 401, headers: { "www-authenticate": `Digest realm="${realm}", nonce="${nonce}", qop="auth", algorithm=MD5` }, json: { message: "Unauthorized (stand-in)" } };
      }
    }
    const route = `${req.method} ${req.path}`;
    if (route === "GET /api/version") return json(200, { api: "2.0.0", server: "2.1.2", text: "PrusaLink 2.1.2", firmware: "6.2.2" }); // [PL-SPEC] shape
    if (route === "GET /api/v1/status") {
      return json(200, {
        printer: { state, temp_nozzle: state === "PRINTING" ? 214.8 : 25.2, target_nozzle: state === "PRINTING" ? 215 : 0, temp_bed: state === "PRINTING" ? 59.9 : 24.1, target_bed: state === "PRINTING" ? 60 : 0 },
        ...(state === "IDLE" ? {} : { job: { id: jobId, progress: 42, time_remaining: 1800 } }),
      });
    }
    if (route === "GET /api/v1/job") {
      if (state === "IDLE") return { status: 204 };
      return json(200, { id: jobId, state, progress: 42, file: { name: current, display_name: current } });
    }
    if (route === "GET /api/v1/storage") return json(200, { storage_list: o.storages });
    const file = /^\/api\/v1\/files\/([^/]+)\/(.+)$/.exec(req.path);
    if (file) {
      const name = decodeURIComponent(file[2]);
      if (req.method === "PUT") {
        if (state !== "IDLE" && name === current) return json(409, { message: "File is being printed (stand-in)" });
        files.set(`${file[1]}/${name}`, req.rawBody.length);
        return { status: 201 }; // [PL-SPEC]
      }
      if (req.method === "POST") {
        if (!files.has(`${file[1]}/${name}`)) return json(404, { message: "No such file (stand-in)" });
        if (state !== "IDLE") return json(409, { message: "Printer is busy (stand-in)" }); // [PL-SPEC] 409
        state = "PRINTING";
        jobId += 1;
        current = name;
        return { status: 204 };
      }
    }
    const job = /^\/api\/v1\/job\/(\d+)(\/pause|\/resume)?$/.exec(req.path);
    if (job && Number(job[1]) === jobId) {
      if (req.method === "PUT" && job[2] === "/pause") {
        if (state !== "PRINTING") return json(409, { message: "Not printing (stand-in)" });
        state = "PAUSED";
        return { status: 204 };
      }
      if (req.method === "PUT" && job[2] === "/resume") {
        if (state !== "PAUSED") return json(409, { message: "Not paused (stand-in)" });
        state = "PRINTING";
        return { status: 204 };
      }
      if (req.method === "DELETE" && !job[2]) {
        if (state === "IDLE") return json(409, { message: "No job (stand-in)" });
        state = "IDLE";
        return { status: 204 };
      }
    }
    return json(404, { message: "Not found (stand-in)" });
  }, options);
}
