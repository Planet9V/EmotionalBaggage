// A failed outbound call in words a user understands. Node's fetch rejects with TypeError "fetch failed"
// and the real reason in `cause`; showing "fetch failed" tells the user nothing. Safe for the browser.

type Errorish = { name?: string; message?: string; code?: string; cause?: unknown };

const CODES: Record<string, string> = {
  ECONNREFUSED: "nothing is answering at that address",
  ENOTFOUND: "that address could not be found",
  EAI_AGAIN: "that address could not be looked up",
  ECONNRESET: "the connection was cut off",
  EHOSTUNREACH: "that address cannot be reached from here",
  ENETUNREACH: "that network cannot be reached from here",
  ETIMEDOUT: "it did not answer in time",
  UND_ERR_CONNECT_TIMEOUT: "it did not answer in time",
  UND_ERR_SOCKET: "the connection was cut off",
  CERT_HAS_EXPIRED: "its security certificate has expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: "its security certificate is not trusted",
  SELF_SIGNED_CERT_IN_CHAIN: "its security certificate is not trusted",
};

/** True for the bare messages that say nothing: "fetch failed", "Failed to fetch", "Load failed". */
export function isBareFetchMessage(m: string) {
  return /^(type ?error: )?(fetch failed|failed to fetch|load failed|networkerror when attempting to fetch resource\.?)$/i.test(m.trim());
}

/** Why a call failed, as a clause starting in lower case ("nothing is answering at that address"). */
export function plainNetworkReason(e: unknown): string {
  const err = (e ?? {}) as Errorish;
  if (err.name === "TimeoutError" || err.name === "AbortError") return "it did not answer in time";
  const cause = err.cause as Errorish | undefined;
  if (cause && typeof cause === "object") {
    if (cause.name === "BlockedAddress" && cause.message) return cause.message.replace(/\.$/, "");
    const code = cause.code ?? (cause.cause as Errorish | undefined)?.code;
    if (code && CODES[code]) return CODES[code];
    if (cause.name === "TimeoutError") return "it did not answer in time";
  }
  if (err.code && CODES[err.code]) return CODES[err.code];
  const m = err.message ?? (typeof e === "string" ? e : "");
  if (!m || isBareFetchMessage(m)) return "it could not be reached";
  return m.replace(/\.$/, "");
}

/** An error's own message, unless it is a bare network failure, then the plain reason as a sentence. */
export function plainMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const err = (e ?? {}) as Errorish;
  if (m && !isBareFetchMessage(m) && err.name !== "TimeoutError" && err.name !== "AbortError") return m;
  const r = plainNetworkReason(e);
  return `${r.charAt(0).toUpperCase()}${r.slice(1)}.`;
}
