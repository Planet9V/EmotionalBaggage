// Shared plumbing for the stand-in servers in this folder.
//
// A stand-in is a small HTTP server, started on a random free port on 127.0.0.1, that answers in the
// shape of an outside service so tests can exercise the app's integration code without calling the
// real thing. Every stand-in records every request it receives (method, path, query, headers and the
// parsed body) and can be told to fail: a wrong key, a forced status code, or a slow answer.
//
// Only Node built-ins are used (node:http, node:crypto); no npm packages.
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type UploadedFile = {
  /** form field name, for example "file" */
  field: string;
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
};

/** A parsed multipart/form-data body: plain fields as strings, file parts listed separately. */
export type MultipartBody = { kind: "multipart"; fields: Record<string, string>; files: UploadedFile[] };

export type RecordedRequest = {
  method: string;
  /** path without the query string */
  path: string;
  query: Record<string, string>;
  headers: IncomingHttpHeaders;
  /** JSON bodies parsed to a value, multipart bodies to MultipartBody, anything else as a string, no body as null */
  body: unknown;
  rawBody: Buffer;
};

/** Failure options every stand-in accepts. They can be changed while running with set(). */
export type FailureOptions = {
  /** answer every request (or only requests to failPath) with this status and a JSON error body */
  failWith?: number;
  /** limit failWith to this exact path, for example "/v1/embeddings" */
  failPath?: string;
  /** wait this long before answering, for timeout tests */
  delayMs?: number;
};

export type StandIn<O> = {
  /** base URL, for example http://127.0.0.1:41234 (no trailing slash) */
  url: string;
  /** every request received, in order, including ones answered with an error */
  requests: RecordedRequest[];
  /** change options while running */
  set(options: Partial<O>): void;
  close(): Promise<void>;
};

export type Reply = {
  status: number;
  headers?: Record<string, string>;
  /** a value to send as JSON, or a Buffer/string sent as is; undefined sends an empty body */
  json?: unknown;
  raw?: string | Buffer;
  /** Server-Sent Events: each string is sent as one "data: ..." event */
  sse?: string[];
};

export type Handler<O> = (req: RecordedRequest, options: O, base: string) => Reply | Promise<Reply>;

export const json = (status: number, body: unknown, headers?: Record<string, string>): Reply => ({ status, json: body, headers });

export function parseMultipart(raw: Buffer, contentType: string): MultipartBody {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const out: MultipartBody = { kind: "multipart", fields: {}, files: [] };
  if (!m) return out;
  const delim = Buffer.from(`--${m[1] ?? m[2]}`);
  let at = raw.indexOf(delim);
  while (at !== -1) {
    at += delim.length;
    if (raw.subarray(at, at + 2).toString() === "--") break;
    at += 2; // CRLF after the boundary line
    const next = raw.indexOf(delim, at);
    if (next === -1) break;
    const part = raw.subarray(at, next - 2); // drop the CRLF before the next boundary
    const split = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, split).toString("utf8");
    const content = part.subarray(split + 4);
    const name = /name="([^"]*)"/i.exec(head)?.[1] ?? "";
    const filename = /filename="([^"]*)"/i.exec(head)?.[1];
    const type = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? "application/octet-stream";
    if (filename !== undefined) out.files.push({ field: name, filename, contentType: type.trim(), size: content.length, content: Buffer.from(content) });
    else out.fields[name] = content.toString("utf8");
    at = next;
  }
  return out;
}

function parseBody(raw: Buffer, contentType: string): unknown {
  if (raw.length === 0) return null;
  if (/multipart\/form-data/i.test(contentType)) return parseMultipart(raw, contentType);
  const text = raw.toString("utf8");
  if (/json/i.test(contentType)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (/application\/x-www-form-urlencoded/i.test(contentType)) return Object.fromEntries(new URLSearchParams(text));
  return text;
}

/** The key sent as "Authorization: Bearer <key>", or undefined. */
export const bearer = (h: IncomingHttpHeaders) => /^Bearer\s+(.+)$/i.exec(h.authorization ?? "")?.[1];

export async function startStandIn<O extends FailureOptions>(defaults: O, handler: Handler<O>, options?: Partial<O>): Promise<StandIn<O>> {
  const opts: O = { ...defaults, ...(options ?? {}) };
  const requests: RecordedRequest[] = [];
  const timers = new Set<NodeJS.Timeout>();
  let base = "";

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        const rawBody = Buffer.concat(chunks);
        const u = new URL(req.url ?? "/", "http://stand-in");
        const rec: RecordedRequest = {
          method: req.method ?? "GET",
          path: u.pathname,
          query: Object.fromEntries(u.searchParams),
          headers: req.headers,
          body: parseBody(rawBody, String(req.headers["content-type"] ?? "")),
          rawBody,
        };
        requests.push(rec);
        if (opts.delayMs && opts.delayMs > 0) {
          await new Promise<void>((resolve) => {
            const t = setTimeout(() => {
              timers.delete(t);
              resolve();
            }, opts.delayMs);
            timers.add(t);
          });
        }
        if (res.destroyed) return;
        let reply: Reply;
        if (opts.failWith && (!opts.failPath || opts.failPath === rec.path)) {
          reply = json(opts.failWith, { error: { message: `stand-in forced failure ${opts.failWith}`, code: opts.failWith } });
        } else {
          try {
            reply = await handler(rec, opts, base);
          } catch (e) {
            reply = json(500, { error: { message: `stand-in handler threw: ${(e as Error).message}` } });
          }
        }
        send(res, reply);
      })();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url: base,
    requests,
    set(next) {
      Object.assign(opts, next);
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const t of timers) clearTimeout(t);
        timers.clear();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function send(res: ServerResponse, r: Reply) {
  if (r.sse) {
    res.writeHead(r.status, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", ...(r.headers ?? {}) });
    for (const ev of r.sse) res.write(`data: ${ev}\n\n`);
    res.end();
    return;
  }
  if (r.json !== undefined) {
    res.writeHead(r.status, { "content-type": "application/json", ...(r.headers ?? {}) });
    res.end(JSON.stringify(r.json));
    return;
  }
  res.writeHead(r.status, r.headers ?? {});
  res.end(r.raw ?? undefined);
}
