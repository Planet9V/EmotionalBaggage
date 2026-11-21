// Where in Admin a not-configured or unreachable service is set up, worked out from the sentence the
// server gave. Every such error shows this link, so no error is a dead end. Safe for the browser.

export const ADMIN_MODELS = "/admin?tab=models";
export const ADMIN_CREDENTIALS = "/admin?tab=credentials";
export const ADMIN_PRINTERS = "/admin?tab=printers";
/** The planner's address is set on the Models tab. */
export const ADMIN_PLANNER = "/admin?tab=models#planner-url";

export type AdminLink = { href: string; label: string };

const RULES: [RegExp, AdminLink][] = [
  [/perplexity/i, { href: ADMIN_CREDENTIALS, label: "Connect Perplexity in Admin, Credentials" }],
  [/planner/i, { href: ADMIN_PLANNER, label: "Set the planner address in Admin, Models" }],
  [/slicer/i, { href: ADMIN_PRINTERS, label: "Set up the slicer in Admin, Printers" }],
  [/printer/i, { href: ADMIN_PRINTERS, label: "Open Admin, Printers" }],
  [/\b(amazon|seller central|instagram|x account|channel account|connect x)\b/i, { href: ADMIN_CREDENTIALS, label: "Open Admin, Credentials" }],
  [/(reasoning|embedding) model|admin, models|model (host|server|provider)|ollama|lm studio|openrouter|the model (did not|could not|answered)/i, { href: ADMIN_MODELS, label: "Open Admin, Models" }],
  [/\b(api )?key\b.*\b(missing|needed|needs|not set|refused)|needs a key/i, { href: ADMIN_CREDENTIALS, label: "Open Admin, Credentials" }],
];

/** The Admin page that fixes the error the sentence describes, or null when it is not a set-up problem. */
export function adminLinkFor(message: string, status?: number): AdminLink | null {
  for (const [re, link] of RULES) if (re.test(message)) return link;
  // 503 from a route wrapped in route() means a service is not configured; the model layer's 502 and 504 mean unreachable.
  if (status === 503) return { href: ADMIN_MODELS, label: "Open Admin, Models" };
  return null;
}
