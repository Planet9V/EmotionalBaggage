// A launch template: a dated checklist for one way of launching a product. Templates are code, so
// they are reviewed and tested like code. Using one copies its steps into the concept as rows
// (marketing/launch); from then on the rows are the user's to edit, and the template is not read again.
type TemplateRequirement = { kind: "gate"; stage: "concept" | "research" | "design" | "prototype" | "production" | "marketing" | "sales" };

type TemplateStep = {
  /** unique within the template; the row's key is "<launch key>-<this>" */
  key: string;
  title: string;
  phase: string;
  /** days before launch day this step is due; 0 is launch day; negative is after */
  daysBefore: number;
  /** working minutes, for the order of operations */
  minutes: number;
  /** keys (in this template) of steps that have to be finished first */
  after?: string[];
  why: string;
  how: string;
  /** cannot be done before this stage's gate is passed */
  requires?: TemplateRequirement[];
  /** the step states, or depends on, a rule of the platform (its account, listing, review or advertising rules) */
  platformRule?: boolean;
  /** the platform's own page for that rule. Every step with `platformRule` has this or `check`. */
  source?: string;
  /** no page was found for the rule: the step is worded as something to check, and says so */
  check?: boolean;
};

export type LaunchTemplate = {
  id: string;
  label: string;
  /** the name written to the launch row's channel field */
  channel: string;
  blurb: string;
  steps: TemplateStep[];
};

/** The sentence added to a step that rests on a platform rule nobody has sourced. */
export const CHECK_PROMPT = "Check the platform's own current help pages for this before you rely on it; the rules change.";
