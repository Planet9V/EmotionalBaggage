// Slack messages: one pure function per event, from the event's facts to Block Kit JSON and a plain-text fallback.
// The platform channel's are in messagesPlatform.ts, the workspace channels' in messagesWorkspace.ts.
import type { SlackMessage } from "./build";
import type { EventKey, EventPayload } from "./events";
import type { SlackContext } from "./links";
import { PLATFORM_MESSAGES } from "./messagesPlatform";
import { WORKSPACE_MESSAGES } from "./messagesWorkspace";

type Builders = { [K in EventKey]: (payload: EventPayload<K>, ctx: SlackContext) => SlackMessage };

/** Every builder, by event key. */
export const MESSAGE_BUILDERS: Builders = { ...PLATFORM_MESSAGES, ...WORKSPACE_MESSAGES };

/** The message for an event: `buildMessage("workspace.gate.passed", facts, { baseUrl })`. Pure; throws only on a bad base address. */
export function buildMessage<K extends EventKey>(key: K, payload: EventPayload<K>, ctx: SlackContext): SlackMessage {
  return MESSAGE_BUILDERS[key](payload, ctx);
}
