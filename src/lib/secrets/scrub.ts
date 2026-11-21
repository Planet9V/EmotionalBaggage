// The one place a secret is removed from a text before the text is logged, shown or returned.
// The owner's rule is that no secret is ever logged or returned; every message built from an error
// of an outbound call (models, printers, channels, connection tests) passes through scrub().
//
// Two kinds of removal run on every call:
//   1. The exact values the caller holds (a saved key, a printer's access code, a database password).
//   2. The shapes a secret takes in a text even when the caller does not hold its value: a bearer
//      token, a provider key such as sk-..., a key in a URL query, a password in a URL
//      (https://user:pass@host), and a key inside JSON ("api_key": "...").

const HIDDEN = "[hidden]";

/** A saved value, a list of them, or none. A null, undefined or empty value is ignored. */
export type Secrets = string | null | undefined | readonly (string | null | undefined)[];

const SENSITIVE_NAME = "(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|client[_-]?secret|secret|password|passwd|pwd|passcode|token|key|signature|sig|authorization|auth)";

const SHAPES: readonly [RegExp, string][] = [
  // Authorization: Bearer abc.def / Basic abc==
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${HIDDEN}`],
  // Provider keys: sk-..., or-..., lm-..., pplx-..., also the project and test forms (sk-proj-..., sk_live_...)
  [/\b(?:sk|or|lm|pk|rk|pplx)[-_][A-Za-z0-9_\-*]{8,}/g, HIDDEN],
  // https://user:pass@host or https://token@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]*(?::[^/\s@]*)?@/gi, `$1${HIDDEN}@`],
  // ?api_key=...&x=1 or &token=...  (the value stops at & ; whitespace or a quote)
  [new RegExp(`([?&;]${SENSITIVE_NAME}=)[^&;\\s"'<>]+`, "gi"), `$1${HIDDEN}`],
  // JSON: "api_key": "value" (a string value, with escaped quotes allowed)
  [new RegExp(`("${SENSITIVE_NAME}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, "gi"), `$1"${HIDDEN}"`],
  // header or log style: password=value, token: value
  [new RegExp(`\\b(${SENSITIVE_NAME}\\s*[=:]\\s*)(?!\\[hidden\\]|(?:Bearer|Basic)\\b)[^\\s,;&"'<>]{4,}`, "gi"), `$1${HIDDEN}`],
];

/** Replaces every secret in a text with [hidden]. */
export function scrub(text: string, secrets?: Secrets): string {
  let out = String(text ?? "");
  const list = secrets == null ? [] : typeof secrets === "string" ? [secrets] : secrets;
  // Longest first, so a secret that contains another is removed whole.
  const values = [...new Set(list.filter((s): s is string => typeof s === "string" && s.length > 0))].sort((a, b) => b.length - a.length);
  for (const s of values) out = out.split(s).join(HIDDEN);
  for (const [re, to] of SHAPES) out = out.replace(re, to);
  return out;
}
