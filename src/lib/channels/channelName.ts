// Safe for the browser: which of the two sendable channels a row's `channel` names.
import { findChannel, channelName, type SendChannel } from "./registry";
export type { SendChannel };

/** "X", "x", "twitter", "Instagram" and "ig" name the two channels this app can send to. */
export function channelOf(raw: unknown): SendChannel | null {
  const c = findChannel(raw);
  return c && c.supports.includes("send") ? (c.id as SendChannel) : null;
}

/** The name shown for a sendable channel. */
export const sendName = (ch: SendChannel | null) => (ch ? channelName(ch) : "");
