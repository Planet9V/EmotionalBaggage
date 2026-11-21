// Shared HTTP plumbing for the adapters that talk HTTP: time limit, plain-sentence failures, secrets scrubbed.
import { DEFAULT_TIMEOUT_MS, PrinterError, type AdapterOptions, type PrinterValues, type TestOutcome } from "./adapter";
import { blockedIn, blockedSentence, safeFetch } from "@/lib/net/outbound";
import { scrub } from "@/lib/secrets/scrub";

export const secondsText = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)} seconds` : `${ms} ms`);

/** The sentence for a failed network call. */
function networkSentence(e: unknown, secrets: (string | null | undefined)[], ms: number): { kind: PrinterError["kind"]; message: string } {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { kind: "timeout", message: `No answer within ${secondsText(ms)}.` };
  const refused = blockedIn(e);
  if (refused) return { kind: "unreachable", message: blockedSentence(refused) };
  const code = err?.cause?.code;
  if (code === "ECONNREFUSED") return { kind: "unreachable", message: "Nothing answered at that address (connection refused). Check the address and that the service is running." };
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { kind: "unreachable", message: "That host name could not be found. Check the address." };
  if (code === "ECONNRESET") return { kind: "unreachable", message: "The connection was dropped before an answer came back." };
  const why = scrub(err?.cause?.message ?? err?.message ?? String(e), secrets).slice(0, 300);
  return { kind: "unreachable", message: `Could not reach it: ${why}` };
}

async function bodyText(res: Response, secrets: (string | null | undefined)[]): Promise<string | undefined> {
  try {
    const text = await res.text();
    let said = text;
    try {
      const j = JSON.parse(text) as { error?: unknown; message?: unknown };
      const e = j.error as { message?: unknown } | string | undefined;
      said = typeof e === "string" ? e : typeof e?.message === "string" ? e.message : typeof j.message === "string" ? j.message : text;
    } catch {
      // not JSON: keep the text
    }
    const clean = scrub(said, secrets).trim().slice(0, 300);
    return clean || undefined;
  } catch {
    return undefined;
  }
}

/** The sentence for an HTTP answer that was not a success. */
export async function httpSentence(
  res: Response,
  who: string,
  secrets: (string | null | undefined)[],
  hint = "Check the address."
): Promise<{ kind: PrinterError["kind"]; message: string; detail: Record<string, unknown> }> {
  const says = await bodyText(res, secrets);
  const detail = { status: res.status, ...(says ? { says } : {}) };
  if (res.status === 401 || res.status === 403) return { kind: "refused", message: `${who} refused the key (HTTP ${res.status}). Check the key.`, detail };
  if (res.status === 404) return { kind: "not-found", message: `${who} has nothing at that path (HTTP 404). ${hint}`, detail };
  if (res.status === 409) return { kind: "busy", message: `${who} refused: it is busy or in the wrong state for that (HTTP 409).${says ? ` It said: ${says}` : ""}`, detail };
  if (res.status >= 500) return { kind: "failed", message: `${who} answered with a server error (HTTP ${res.status}).`, detail };
  return { kind: "failed", message: `${who} answered HTTP ${res.status}.`, detail };
}

/** Base for the HTTP adapters. */
export abstract class HttpAdapterBase {
  protected readonly address: string;
  protected readonly ms: number;
  constructor(
    protected readonly v: PrinterValues,
    opts: AdapterOptions = {}
  ) {
    this.address = (v.address ?? "").replace(/\/+$/, "");
    this.ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Every secret this adapter holds. Scrubbed from everything it says. */
  protected abstract secrets(): (string | null | undefined)[];
  protected abstract readonly who: string;
  protected notFoundHint = "Check the address.";

  /** One time-limited call. Throws PrinterError for network failures; the caller judges the status. */
  protected async send(path: string, init: RequestInit = {}, ms = this.ms): Promise<Response> {
    try {
      return await safeFetch(`${this.address}${path}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(ms) });
    } catch (e) {
      const s = networkSentence(e, this.secrets(), ms);
      throw new PrinterError(s.kind, s.message);
    }
  }

  /** Throws PrinterError unless the status is one of `ok`. */
  protected async need(res: Response, ok: number[]): Promise<Response> {
    if (ok.includes(res.status)) return res;
    const s = await httpSentence(res, this.who, this.secrets(), this.notFoundHint);
    throw new PrinterError(s.kind, s.message, res.status);
  }

  protected async json<T>(res: Response): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new PrinterError("bad-response", `${this.who} answered, but not in the form its documentation describes. Check the address.`);
    }
  }

  /** Runs a test body, turning every thrown PrinterError into { ok: false }. */
  protected async attempt(fn: () => Promise<TestOutcome>): Promise<TestOutcome> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PrinterError) return { ok: false, message: e.message };
      return { ok: false, message: `${this.who} test failed: ${scrub(String((e as Error)?.message ?? e), this.secrets()).slice(0, 200)}` };
    }
  }

  async close(): Promise<void> {}
}

export const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
export const str = (x: unknown): string | null => (typeof x === "string" && x ? x : null);
