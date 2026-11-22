// Slack message text: the one place user-supplied words are made safe for Slack's mrkdwn.
// Pure; no network, no database. Specification: docs/design/slack.md.
//
// What is guaranteed for any string that goes through `m`, `long` or `plain`:
//  - "&", "<" and ">" are written as Slack's own entities, so user text can never form <@U1>, <#C1>, <!channel>,
//    <!here>, <https://x|label> or any other control sequence;
//  - "@channel", "@here" and "@everyone" are broken with a zero-width space, so they do not notify even where a
//    channel was set to read plain "@" words;
//  - "://" is broken the same way, so a pasted address is not turned into a link by Slack's own link finder (a bare
//    domain name such as "example.com" is still linked by Slack itself; the sender switches unfurling off, step 2);
//  - line breaks and control characters become single spaces;
//  - the text is cut to a limit before it is escaped, so no entity is ever cut in two.

/** Slack's structural limits for Block Kit (docs.slack.dev, "Block Kit reference"). */
export const SLACK_LIMITS = {
  /** characters in a section block's text */
  sectionText: 3000,
  /** characters in a button's label */
  buttonText: 75,
  /** characters in an action_id */
  actionId: 255,
  /** characters in a button's value */
  buttonValue: 2000,
  /** characters in a button's url */
  buttonUrl: 3000,
  /** blocks in one message */
  blocks: 50,
  /** elements in one actions block */
  actionElements: 25,
  /** characters in a context block element */
  contextText: 3000,
} as const;

/** The longest a name, an address or a short phrase from a person may be in a message. */
export const SHORT = 200;
/** The longest a free-text note, request or review may be in a message. */
export const LONG = 500;

const ELLIPSIS = "…";
const ZWSP = "​";

/** Cuts to at most `max` characters (not UTF-16 units), ending in an ellipsis when something was cut. */
export function clip(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  return chars.slice(0, Math.max(0, max - 1)).join("").trimEnd() + ELLIPSIS;
}

/** Line breaks, tabs and other control characters as single spaces; runs of space collapse; ends trimmed. */
const singleLine = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();

/** Escapes one piece of user text for mrkdwn. Does not cut it; use `clip` first. */
function escapeMrkdwn(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@(channel|here|everyone)\b/gi, `@${ZWSP}$1`)
    .replace(/:\/\//g, `:${ZWSP}//`);
}

/** Text that is already safe to place inside a message. Only this module makes one. */
export class Safe {
  constructor(readonly text: string) {}
  toString(): string {
    return this.text;
  }
}

/** User words, made safe and cut to `max` characters (default: a name's length). */
export function long(text: string, max: number = LONG): Safe {
  return new Safe(escapeMrkdwn(clip(singleLine(String(text ?? "")), max)));
}

type Part = string | number | Safe | null | undefined | false;

const partText = (v: Part): string => {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Safe) return v.text;
  if (typeof v === "number") return String(v);
  return escapeMrkdwn(clip(singleLine(v), SHORT));
};

/**
 * Template tag for a message. Every string put in is treated as user text: single line, cut to SHORT characters and
 * escaped. Numbers go in as they are. A `Safe` (from `long`, or from another `m`) goes in unchanged. The literal
 * parts of the template are the app's own wording and are not touched.
 */
export function m(strings: TemplateStringsArray, ...parts: Part[]): Safe {
  let out = strings[0] ?? "";
  parts.forEach((p, i) => {
    out += partText(p) + (strings[i + 1] ?? "");
  });
  return new Safe(out);
}

/** "a", "a and b", "a, b and c". */
export function list(items: readonly string[]): Safe {
  const parts = items.map((s) => partText(s));
  if (parts.length <= 1) return new Safe(parts.join(""));
  return new Safe(`${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);
}

/** The final guard on a section's text: at most `max` characters, never ending inside an entity. */
export function capText(text: string, max: number = SLACK_LIMITS.sectionText): string {
  if ([...text].length <= max) return text;
  const cut = [...text].slice(0, max - 1).join("");
  return cut.replace(/&[a-z]{0,3}$/, "").trimEnd() + ELLIPSIS;
}

/** A button label: the app's own wording, held to Slack's limit. */
export const label = (text: string): string => clip(text, SLACK_LIMITS.buttonText);
