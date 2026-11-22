import type { LaunchTemplate } from "./types";
import { channelName } from "@/lib/channels/registry";

export const ownSite: LaunchTemplate = {
  id: "own-site",
  label: channelName("own-site"),
  channel: channelName("own-site"),
  blurb: "A store on your own domain: set up, payments and policies, the page, a test order, launch and the first week.",
  steps: [
    { key: "domain", title: "Register the domain and set up the store", phase: "Set up", daysBefore: 35, minutes: 180, why: "Everything else is built on the address and the store.", how: "Pick one store platform and stay with it. Put the product name and the brand kit's colours and type in the theme." },
    { key: "payments", title: "Open the payment account and check what it requires", phase: "Payments and policies", daysBefore: 30, minutes: 120, after: ["domain"], why: "Payment providers check the business and the product before they pay out, and that takes time.", how: "Check what your provider requires for this product and these countries before you rely on it.", platformRule: true, check: true },
    { key: "shipping", title: "Set shipping rates and the packing process", phase: "Payments and policies", daysBefore: 21, minutes: 180, after: ["domain"], why: "Shipping set wrong turns each order into a loss.", how: "Use the packed weight from the build and carrier quotes. Compare with the margin on Unit economics." },
    { key: "policies", title: "Write the returns, privacy and terms pages", phase: "Payments and policies", daysBefore: 21, minutes: 240, after: ["domain"], why: "Buyers read the returns page before they pay.", how: "Write them in plain words. Have each reviewed by someone qualified where your country requires particular wording; this is not legal advice." },
    { key: "page", title: "Build the product page from the approved landing page", phase: "Launch content", daysBefore: 21, minutes: 480, after: ["domain"], why: "One page, one call to action.", how: "Use the landing page rows: hero, problem, how it works, proof, price. Every claim links to its proof." },
    { key: "analytics", title: "Add the tracked links and check each opens the right page", phase: "Launch content", daysBefore: 14, minutes: 90, after: ["page"], why: "A visit that cannot be traced to a post teaches nothing.", how: "Make one link per post and ad on the Links page." },
    { key: "list", title: "Build the email list from the people who asked to hear", phase: "Launch content", daysBefore: 21, minutes: 120, why: "Email is the one channel you own.", how: "Collect addresses only with a clear sentence about what you will send." },
    { key: "test-order", title: "Place a test order and a test refund end to end", phase: "Launch day", daysBefore: 5, minutes: 90, after: ["payments", "shipping", "policies", "page"], why: "The first real order should not be the first time the checkout is used.", how: "Pay, receive the email, ship a parcel to yourself, refund it." },
    { key: "stock", title: "Count the stock and set the quantity limit", phase: "Launch day", daysBefore: 3, minutes: 30, why: "Selling what you cannot ship is worse than selling out.", how: "Use units from the first batch less units kept for testing and samples.", requires: [{ kind: "gate", stage: "production" }] },
    { key: "launch", title: "Open the store to orders", phase: "Launch day", daysBefore: 0, minutes: 30, after: ["test-order", "stock"], why: "The date everything else is counted from.", how: "Switch off password protection. Send the launch email." },
    { key: "launch-email", title: "Send the launch email and posts", phase: "Launch day", daysBefore: 0, minutes: 60, after: ["launch", "list", "analytics"], why: "The list has been waiting.", how: "Use the approved launch email. Every link is a tracked link." },
    { key: "first-week", title: "Read the first week's results against the target", phase: "After launch", daysBefore: -7, minutes: 90, after: ["launch"], why: "A week shows whether the page and the price work.", how: "Enter spend, clicks and orders on the Results page. Note the sample size before changing anything." },
    { key: "feedback", title: "Ask the first buyers what nearly stopped them", phase: "After launch", daysBefore: -10, minutes: 120, after: ["launch"], why: "The page can be fixed only by what buyers say stopped them.", how: "Three questions by email. Record the answers as claims or requirements." },
  ],
};
