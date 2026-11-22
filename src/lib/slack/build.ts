// Block Kit assembly: the small JSON types a message is made of, and the helpers that build them with Slack's limits
// applied. Pure.
import { ACTIONS, encodeActionValue, type ActionKey, type ActionValue, type ValueActionKey } from "./actions";
import { SLACK_LIMITS, Safe, capText, label } from "./text";

export type SlackButton = {
  type: "button";
  text: { type: "plain_text"; text: string; emoji: false };
  action_id: string;
  value?: string;
  url?: string;
  style?: "primary" | "danger";
};
export type SlackSection = { type: "section"; text: { type: "mrkdwn"; text: string } };
export type SlackContextBlock = { type: "context"; elements: { type: "mrkdwn"; text: string }[] };
export type SlackActions = { type: "actions"; elements: SlackButton[] };
export type SlackBlock = SlackSection | SlackContextBlock | SlackActions;

/** What the sender posts: the blocks, and the plain text Slack shows in notifications and where blocks cannot show. */
export type SlackMessage = { text: string; blocks: SlackBlock[] };

/** The buttons that open a page. */
export type LinkActionKey = Exclude<ActionKey, ValueActionKey>;

const base = (key: ActionKey): SlackButton => {
  const a = ACTIONS[key];
  return { type: "button", text: { type: "plain_text", text: label(a.label), emoji: false }, action_id: key, ...(a.style ? { style: a.style } : {}) };
};

/** A button that opens a page. */
export const linkButton = (key: LinkActionKey, url: string): SlackButton => ({ ...base(key), url });

/** A button that carries a value; the value is checked against the action's schema before it is written. */
export const valueButton = <K extends ValueActionKey>(key: K, value: ActionValue<K>): SlackButton => ({ ...base(key), value: encodeActionValue(key, value) });

/**
 * One message: the text as a section, an optional context line (the concept's name), and the buttons. The text is
 * also the plain-text fallback. The text is cut to Slack's limit.
 */
export function message(text: Safe, buttons: SlackButton[], context?: Safe): SlackMessage {
  const body = capText(text.text);
  const blocks: SlackBlock[] = [{ type: "section", text: { type: "mrkdwn", text: body } }];
  if (context) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: capText(context.text, SLACK_LIMITS.contextText) }] });
  if (buttons.length) blocks.push({ type: "actions", elements: buttons.slice(0, SLACK_LIMITS.actionElements) });
  return { text: body, blocks };
}
