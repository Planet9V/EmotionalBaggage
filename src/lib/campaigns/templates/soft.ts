import type { LaunchTemplate } from "./types";

export const softLaunch: LaunchTemplate = {
  id: "soft",
  label: "Soft launch (no crowdfunding)",
  channel: "Soft launch",
  blurb: "Sell the first units to a named list you can talk to, learn from them, fix what they found, then decide whether to open a channel.",
  steps: [
    { key: "list", title: "Name the people who will buy the first units", phase: "Pick the list", daysBefore: 35, minutes: 180, why: "A soft launch teaches you only when you can ask each buyer what happened.", how: "A list of real people or small groups, from the personas: enough to learn from, small enough to ask each one." },
    { key: "offer", title: "Write the offer: what it is, the price, what you will do if it is wrong", phase: "Offer", daysBefore: 28, minutes: 180, after: ["list"], why: "A clear offer is the first test of the proposition.", how: "One page. The approved positioning line, the price from Pricing, the return promise." },
    { key: "price-check", title: "Check the price leaves a margin after fees and shipping", phase: "Offer", daysBefore: 28, minutes: 90, why: "A soft launch at a loss still spends money.", how: "Read the channel margin on Production, Unit economics." },
    { key: "waitlist", title: "Open a waiting list or pre-order form", phase: "Offer", daysBefore: 21, minutes: 120, after: ["offer"], why: "Who says yes in advance is the first number you can trust.", how: "Do not take payment until units exist. Tracked link in every invitation." },
    { key: "invite", title: "Invite the list, one person at a time", phase: "Offer", daysBefore: 14, minutes: 240, after: ["waitlist", "list"], why: "Replies teach more than clicks.", how: "A short personal message. Record each reply." },
    { key: "stock", title: "Make or set aside the first units", phase: "Launch", daysBefore: 7, minutes: 480, after: ["price-check"], why: "You cannot sell what is not there.", how: "Use units from a build that passed its acceptance tests.", requires: [{ kind: "gate", stage: "prototype" }] },
    { key: "launch", title: "Deliver the first units", phase: "Launch", daysBefore: 0, minutes: 240, after: ["stock", "invite"], why: "The date everything else is counted from.", how: "Hand over or post with a note asking for one honest reply." },
    { key: "ask", title: "Ask each buyer what they expected and what they got", phase: "Learn", daysBefore: -7, minutes: 240, after: ["launch"], why: "The gap between expected and got is the list of fixes.", how: "Three questions. Record the answers as claims, requirements and questions." },
    { key: "fix", title: "List what to change and what it costs", phase: "Learn", daysBefore: -14, minutes: 180, after: ["ask"], why: "Some fixes are cheap and some are a new product.", how: "Add each as a requirement or a question; cost it on the economics." },
    { key: "decide", title: "Decide whether to open a channel, and which", phase: "Learn", daysBefore: -21, minutes: 120, after: ["fix"], why: "The soft launch was only worth doing if it changes the next decision.", how: "Record the decision on the decision tree with what the buyers said." },
  ],
};
