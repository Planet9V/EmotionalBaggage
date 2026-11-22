// The Slack capability, step 1: the event catalogue, the message builders and the button values. Pure TypeScript.
// Used from step 2 of docs/design/slack.md (Admin, Slack and the platform channel).
export { ACTIONS, ACTION_KEYS, SLACK_ROLES, carriesValue, decodeActionValue, encodeActionValue } from "./actions";
export type { ActionKey, ActionValue, Decoded, SlackRole, ValueActionKey } from "./actions";
export type { SlackActions, SlackBlock, SlackButton, SlackContextBlock, SlackMessage, SlackSection } from "./build";
export { EVENTS, EVENT_KEYS, eventsFor } from "./events";
export type { EventKey, EventPayload, SlackAudience } from "./events";
export type { SlackContext } from "./links";
export { MESSAGE_BUILDERS, buildMessage } from "./messages";
export { SLACK_LIMITS } from "./text";
