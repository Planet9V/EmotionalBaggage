import type { LaunchTemplate } from "./types";

export const retail: LaunchTemplate = {
  id: "retail",
  label: "Retail or wholesale outreach",
  channel: "Retail or wholesale",
  blurb: "Find buyers, prepare the sell sheet and terms, send samples, follow up and turn a yes into a purchase order. Launch day is when the product is on the shelf.",
  steps: [
    { key: "targets", title: "List the shops and buyers that already sell things like this", phase: "Find buyers", daysBefore: 90, minutes: 240, why: "A buyer who already stocks the neighbour product needs no explaining.", how: "Use the competitors list: where it is sold is where to start. Note the buyer's role, not private details." },
    { key: "sell-sheet", title: "Make a one-page sell sheet", phase: "Prepare", daysBefore: 80, minutes: 360, why: "A buyer decides in a minute whether to read more.", how: "Product, the one claim with its proof, the unit price, the suggested retail price, the pack size." },
    { key: "terms", title: "Set the wholesale price, minimum order and terms", phase: "Prepare", daysBefore: 75, minutes: 180, why: "A wholesale price that leaves no margin makes every sale a loss.", how: "Work the margin at the wholesale price on Production, Unit economics. Add the shop's margin to see the retail price." },
    { key: "samples", title: "Make and pack the samples", phase: "Prepare", daysBefore: 60, minutes: 480, after: ["sell-sheet"], why: "A buyer wants to hold the product.", how: "Use units from a build that passed its acceptance tests.", requires: [{ kind: "gate", stage: "prototype" }] },
    { key: "wave-1", title: "Send the first outreach emails with the sell sheet", phase: "Outreach", daysBefore: 50, minutes: 180, after: ["targets", "sell-sheet", "terms"], why: "Most first emails get no answer.", how: "One ask per email: a call, or a sample. Track each in the Results page as a link." },
    { key: "follow-up", title: "Follow up once, with a sample offer", phase: "Outreach", daysBefore: 40, minutes: 120, after: ["wave-1", "samples"], why: "A second message is often the one that is read.", how: "Short. Offer to post a sample." },
    { key: "meetings", title: "Hold the buyer calls and note every objection", phase: "Outreach", daysBefore: 30, minutes: 300, after: ["follow-up"], why: "An objection raised by three buyers is a requirement.", how: "Record objections as questions or requirements." },
    { key: "agreement", title: "Agree terms, delivery dates and payment in writing", phase: "Close", daysBefore: 21, minutes: 180, after: ["meetings"], why: "What is not written down is disputed later.", how: "Have a qualified person read an agreement before you sign; this is not legal advice." },
    { key: "po-production", title: "Turn the purchase orders into a batch", phase: "Close", daysBefore: 14, minutes: 240, after: ["agreement"], why: "Lead times set the delivery date.", how: "Add the batch to the batch plan with the units the orders need.", requires: [{ kind: "gate", stage: "production" }] },
    { key: "ship", title: "Ship to the shops", phase: "Launch", daysBefore: 3, minutes: 480, after: ["po-production"], why: "The product has to be on the shelf on the date promised.", how: "Send tracking to each buyer." },
    { key: "shelf", title: "Check it is on the shelf and priced as agreed", phase: "Launch", daysBefore: 0, minutes: 60, after: ["ship"], why: "The date everything else is counted from.", how: "Ask each shop for a photo of the shelf." },
    { key: "sell-through", title: "Ask each shop how it is selling", phase: "After launch", daysBefore: -21, minutes: 90, after: ["shelf"], why: "A shop that does not reorder tells you the price or the product is wrong.", how: "Compare sell-through with what the buyer expected." },
  ],
};
