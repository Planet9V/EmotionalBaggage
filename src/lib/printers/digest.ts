// HTTP Digest authentication (RFC 7616) for PrusaLink. PrusaLink's OpenAPI file names exactly one security scheme,
// http digest (github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml). Prusa's help page says the digest is the
// default and can be switched off at the printer. Node's fetch has no digest support, so this answers a 401 challenge once.
import { createHash, randomBytes } from "node:crypto";

type Challenge = { realm: string; nonce: string; qop?: string; opaque?: string; algorithm: string };

function parseChallenge(header: string): Challenge | null {
  const m = /^Digest\s+(.*)$/i.exec(header.trim());
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const part of m[1].matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]*))/g)) out[part[1].toLowerCase()] = part[2] ?? part[3] ?? "";
  if (!out.realm || !out.nonce) return null;
  return { realm: out.realm, nonce: out.nonce, qop: out.qop, opaque: out.opaque, algorithm: out.algorithm || "MD5" };
}

const hash = (alg: string, s: string) => createHash(/sha-?256/i.test(alg) ? "sha256" : "md5").update(s).digest("hex");

/** The Authorization header for one request, or null when the challenge is not a digest this code can answer. */
export function digestHeader(wwwAuthenticate: string, method: string, uri: string, user: string, password: string): string | null {
  // A server may send several challenges; the first Digest one is used.
  const ch = parseChallenge(wwwAuthenticate.split(/,\s*(?=Digest\s)/i).find((c) => /^\s*Digest\s/i.test(c)) ?? wwwAuthenticate);
  if (!ch) return null;
  const alg = ch.algorithm.replace(/-sess$/i, "");
  const qopAuth = ch.qop?.split(",").map((q) => q.trim()).includes("auth");
  const cnonce = randomBytes(8).toString("hex");
  const nc = "00000001";
  let ha1 = hash(alg, `${user}:${ch.realm}:${password}`);
  if (/-sess$/i.test(ch.algorithm)) ha1 = hash(alg, `${ha1}:${ch.nonce}:${cnonce}`);
  const ha2 = hash(alg, `${method}:${uri}`);
  const response = qopAuth ? hash(alg, `${ha1}:${ch.nonce}:${nc}:${cnonce}:auth:${ha2}`) : hash(alg, `${ha1}:${ch.nonce}:${ha2}`);
  const q = (s: string) => `"${s.replace(/["\\]/g, "")}"`;
  const parts = [`username=${q(user)}`, `realm=${q(ch.realm)}`, `nonce=${q(ch.nonce)}`, `uri=${q(uri)}`, `algorithm=${ch.algorithm}`, `response="${response}"`];
  if (qopAuth) parts.push(`qop=auth`, `nc=${nc}`, `cnonce=${q(cnonce)}`);
  if (ch.opaque) parts.push(`opaque=${q(ch.opaque)}`);
  return `Digest ${parts.join(", ")}`;
}
