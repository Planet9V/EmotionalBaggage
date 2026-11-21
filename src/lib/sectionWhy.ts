// One sentence per list section saying why its rows matter: what reads them or which gate counts them.
// Shown in the section's empty state, so it must not repeat the header's blurb.

const WHY: Record<string, string> = {
  "concept/brief": "The brief is what the reviewer challenges and what every AI draft reads first, so the rest of the concept starts here.",
  "concept/press": "Writing the announcement before building shows whether the idea is worth building. The reviewer attacks it before the Concept gate opens.",
  "concept/faq": "Hard questions answered now stop surprises in design and in sales. The landing page and listing draw on these answers.",
  "concept/questions": "An open question blocks the stage it belongs to until it is answered, so the gate can say what is still undecided.",
  "research/claims": "Each claim the plan leans on is checked against sources before the Research gate opens. An unchecked claim is a risk you can see.",
  "design/requirements": "Every test, part and build traces back to a requirement. The Design gate counts how many are settled and tested.",
  "prototype/assembly": "The assembly steps become the order of operations, so you can see how long a build takes and what waits on what.",
  "prototype/tests": "A build passes only when its linked tests pass, and each requirement needs a test that checks it.",
  "production/suppliers": "Lead times and smallest orders decide when a batch can start and how much cash it ties up.",
  "production/methods": "Tooling and per-unit costs from each method go into the unit cost on Unit economics.",
  "sales/channels": "Each channel's fees set the margin worked out on Unit economics and the price options in Pricing.",
};

/** Why a section's rows matter, or a sentence built from the stage's goal for a section with none written. */
export function sectionWhy(store: string, stageLabel: string, stageGoal: string) {
  return WHY[store] ?? `The ${stageLabel} gate reads these rows. The stage's aim: ${stageGoal.charAt(0).toLowerCase()}${stageGoal.slice(1)}`;
}
