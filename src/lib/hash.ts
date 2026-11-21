// The one SHA-256: lower-case hex of a string (as UTF-8) or of bytes. Server code only.
import { createHash } from "node:crypto";

export const sha256 = (input: string | Uint8Array): string => createHash("sha256").update(input).digest("hex");
