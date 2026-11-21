// The one list of channels. Each says what it is called and what the app can do with it. Everything
// that names a channel (the ad specs, the social limits, the inbox and reply forms, the report file
// layouts, the sales channels, the purchase sources) reads this list instead of typing the names.
// Safe for the browser.

export type Capability =
  | "ads" // an ad spec exists (lib/content/channels.ts)
  | "social" // a post spec exists
  | "inbox" // mentions and comments are read into Replies and comments
  | "replies" // a reply can be written for it
  | "send" // the app can post or reply to it itself
  | "import" // a performance report can be imported (lib/campaigns/csv.ts)
  | "sales" // a place the product is sold
  | "purchase"; // a place parts are bought

export type ChannelDef = {
  id: string;
  /** the name shown everywhere */
  name: string;
  /** other spellings read as this channel */
  aliases?: string[];
  supports: readonly Capability[];
};

export const CHANNELS: readonly ChannelDef[] = [
  { id: "x", name: "X", aliases: ["twitter"], supports: ["ads", "social", "inbox", "replies", "send"] },
  { id: "instagram", name: "Instagram", aliases: ["ig"], supports: ["social", "inbox", "replies", "send"] },
  { id: "facebook", name: "Facebook", supports: ["social"] },
  { id: "amazon", name: "Amazon", supports: ["ads", "replies", "import", "sales", "purchase"] },
  { id: "meta", name: "Meta", supports: ["ads", "import"] },
  { id: "google", name: "Google", supports: ["ads", "import"] },
  { id: "pinterest", name: "Pinterest", supports: ["ads", "social"] },
  { id: "tiktok", name: "TikTok", supports: ["ads", "social"] },
  { id: "reddit", name: "Reddit", supports: ["ads", "social"] },
  { id: "linkedin", name: "LinkedIn", supports: ["social"] },
  { id: "micro-center", name: "Micro Center", supports: ["purchase"] },
  { id: "own-printer", name: "Own printer", supports: ["purchase"] },
  { id: "other", name: "Other", supports: ["replies", "import", "purchase"] },
];

export const channelById = (id: string) => CHANNELS.find((c) => c.id === id) ?? null;

/** By id, display name or alias, any case. */
export function findChannel(raw: unknown): ChannelDef | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return null;
  return CHANNELS.find((c) => c.id === v || c.name.toLowerCase() === v || c.aliases?.includes(v)) ?? null;
}

/** The display name of an id (or the text itself when it is not a known channel). */
export const channelName = (id: string) => channelById(id)?.name ?? id;

export const channelsWith = (cap: Capability) => CHANNELS.filter((c) => c.supports.includes(cap));

/** Display names of the channels that support `cap`, in registry order, as a tuple z.enum accepts. */
export const namesWith = (cap: Capability) => channelsWith(cap).map((c) => c.name) as unknown as readonly [string, ...string[]];

/** The two channels the app can send to. */
export type SendChannel = "x" | "instagram";

/** Where parts are bought: the one list for the wizard and the parts list (Bill of materials). */
export const PURCHASE_SOURCES = namesWith("purchase");
