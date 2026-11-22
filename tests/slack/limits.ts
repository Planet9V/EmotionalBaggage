// A small validator for Slack's structural limits on a Block Kit message (docs.slack.dev, "Block Kit reference").
import { SLACK_LIMITS, type SlackMessage } from "@/lib/slack";

/** Returns every limit the message breaks; an empty list means it is acceptable to Slack. */
export function limitProblems(msg: SlackMessage): string[] {
  const bad: string[] = [];
  const len = (s: string) => [...s].length;
  if (!msg.text.trim()) bad.push("the fallback text is empty");
  if (msg.blocks.length === 0) bad.push("no blocks");
  if (msg.blocks.length > SLACK_LIMITS.blocks) bad.push(`${msg.blocks.length} blocks`);
  const ids = new Set<string>();
  for (const block of msg.blocks) {
    if (block.type === "section") {
      if (block.text.type !== "mrkdwn") bad.push("section text is not mrkdwn");
      if (len(block.text.text) === 0) bad.push("empty section text");
      if (len(block.text.text) > SLACK_LIMITS.sectionText) bad.push(`section text of ${len(block.text.text)} characters`);
    } else if (block.type === "context") {
      if (block.elements.length === 0 || block.elements.length > 10) bad.push("context needs 1 to 10 elements");
      for (const e of block.elements) if (len(e.text) > SLACK_LIMITS.contextText) bad.push("context text too long");
    } else {
      if (block.elements.length === 0) bad.push("an actions block with no buttons");
      if (block.elements.length > SLACK_LIMITS.actionElements) bad.push(`${block.elements.length} buttons`);
      for (const b of block.elements) {
        if (b.text.type !== "plain_text") bad.push("button text is not plain_text");
        if (len(b.text.text) === 0 || len(b.text.text) > SLACK_LIMITS.buttonText) bad.push(`button text of ${len(b.text.text)} characters`);
        if (len(b.action_id) === 0 || len(b.action_id) > SLACK_LIMITS.actionId) bad.push("action_id length");
        if (ids.has(b.action_id)) bad.push(`action_id ${b.action_id} used twice`);
        ids.add(b.action_id);
        if (b.value !== undefined && len(b.value) > SLACK_LIMITS.buttonValue) bad.push("value too long");
        if (b.url !== undefined && len(b.url) > SLACK_LIMITS.buttonUrl) bad.push("url too long");
        if ((b.value === undefined) === (b.url === undefined)) bad.push(`button ${b.action_id} needs exactly one of value and url`);
        if (b.url !== undefined && !/^https?:\/\//.test(b.url)) bad.push("url is not http or https");
      }
    }
  }
  return bad;
}
