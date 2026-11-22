// What each ad channel accepts. A limit is enforced (refused over the limit) only when it comes from
// the platform's own page, whose address is in `source`. A limit that is a recommendation, or that
// could not be read from the platform, is a soft warning: the count is shown and the writer is told,
// but nothing is refused. Read on 2026-11-21 (see the note on each channel for what could not be read).
//
// A field is a text, a list of texts, a choice from a list, or a web address.

import { channelName, channelsWith } from "@/lib/channels/registry";

export type FieldSpec = {
  key: string;
  label: string;
  kind: "text" | "list" | "choice" | "url";
  /** the field must be filled before the ad can be approved */
  required?: boolean;
  /** text: characters. list: characters of each item. */
  max?: number;
  /** text: at least this many characters (soft unless enforce) */
  min?: number;
  /** list only */
  minItems?: number;
  maxItems?: number;
  /** words per text, for fields the platform limits by words */
  maxWords?: number;
  choices?: string[];
  /** true only when `max`, `maxItems` and `choices` come from the platform's own page, named in `source` */
  enforce: boolean;
  source?: string;
  /** count the way X counts: emoji and CJK count 2, a web address counts 23 */
  xWeight?: boolean;
  /** how many characters people are shown before the text is cut, when the platform says so */
  shown?: number;
  note?: string;
};

export type ChannelSpec = {
  id: string;
  label: string;
  /** the id in lib/channels/registry.ts; `platform` below is that channel's display name */
  channel: string;
  platform: string;
  /** what the channel's copy is */
  summary: string;
  fields: FieldSpec[];
  /** pages the limits were read from, or the reason none could be */
  sources: { label: string; url: string }[];
  /** what could not be read, said plainly */
  unverified: string;
  /** CSV layout */
  bulk: { layout: "google-ads-editor" | "plain"; source?: string; note: string };
  /** what the stop and scale rule counts, in the platform's words */
  costWord: string;
};

const GOOGLE = "https://support.google.com/google-ads/answer/7684791";
const AMAZON_SB = "https://advertising.amazon.com/API/docs/en-us/sponsored-brands/3-0/openapi/prod";
const X_COUNT = "https://docs.x.com/fundamentals/counting-characters.md";
const X_ADS = "https://docs.x.com/x-ads-api/creatives/reference.md";
const PIN = "https://help.pinterest.com/business/article/pinterest-product-specs";
const META_FB = "https://www.facebook.com/business/ads-guide/image/facebook-feed/traffic";
const META_IG = "https://www.facebook.com/business/ads-guide/image/instagram-feed";
const TIKTOK_SET = "https://ads.tiktok.com/help/article/ad-set-up";
const TIKTOK_SPEC = "https://ads.tiktok.com/help/article?aid=10002745";
const REDDIT_API = "https://ads-api.reddit.com/api/v3/openapi.json";

const TIKTOK_CTAS = ["Shop Now", "View Now", "Get it Now", "Buy Today", "Buy Here", "Learn More", "Order Here", "Shop", "Buy it Now", "Buy Now", "Download", "Visit Store", "Book Now", "Contact Us", "Apply Now", "Play Game", "Watch Now", "Get Quote", "Interested", "Install Now", "Get Showtimes"];
const REDDIT_CTAS = ["Apply Now", "Contact Us", "Download", "Get a Quote", "Get Showtimes", "Install", "Learn More", "Order Now", "Play Now", "Pre-order Now", "See Menu", "Shop Now", "Sign Up", "View More", "Watch Now", "Book Now", "Buy Tickets", "Get Directions", "Listen Now", "Read More", "Subscribe", "Visit Store", "Donate Now", "Remind Me"];

const AD_SPECS: Omit<ChannelSpec, "platform">[] = [
  {
    id: "amazon-sponsored-products",
    label: "Amazon Sponsored Products",
    channel: "amazon",
    summary: "No ad copy: the ad shows your listing's title, image and price. What you write is the product to advertise and the keywords to bid on.",
    fields: [
      { key: "adGroupName", label: "Ad group name", kind: "text", required: true, max: 128, enforce: false },
      { key: "asin", label: "ASIN of the product to advertise", kind: "text", required: true, max: 10, enforce: false },
      { key: "keywords", label: "Keywords", kind: "list", required: true, minItems: 1, maxItems: 50, max: 80, maxWords: 10, enforce: false },
      { key: "negativeKeywords", label: "Negative keywords", kind: "list", maxItems: 50, max: 80, enforce: false },
      { key: "matchType", label: "Match type", kind: "choice", required: true, choices: ["broad", "phrase", "exact"], enforce: false },
    ],
    sources: [{ label: "Amazon Ads Sponsored Brands API (the keyword rule it states is used as a soft guide here)", url: AMAZON_SB }],
    unverified: "Amazon's Sponsored Products specification could not be read here, so every limit on this channel is a soft warning.",
    bulk: { layout: "plain", note: "Plain CSV. Amazon's own bulksheet layout could not be read here; paste the columns into a bulksheet by hand." },
    costWord: "cost per order (ACOS in Amazon's report)",
  },
  {
    id: "amazon-sponsored-brands",
    label: "Amazon Sponsored Brands",
    channel: "amazon",
    summary: "A brand name, a headline, up to three products and the keywords to bid on.",
    fields: [
      { key: "campaignName", label: "Campaign name", kind: "text", required: true, max: 128, enforce: true, source: AMAZON_SB },
      { key: "brandName", label: "Brand name", kind: "text", required: true, max: 30, enforce: true, source: AMAZON_SB },
      { key: "headline", label: "Headline", kind: "text", required: true, max: 50, enforce: true, source: AMAZON_SB, note: "50 characters; 35 in the Japan marketplace." },
      { key: "asins", label: "ASINs (one to three)", kind: "list", required: true, minItems: 1, maxItems: 3, max: 10, enforce: true, source: AMAZON_SB },
      { key: "keywords", label: "Keywords", kind: "list", required: true, minItems: 1, maxItems: 50, maxWords: 10, enforce: true, source: AMAZON_SB, note: "Ten words at most per keyword." },
    ],
    sources: [{ label: "Amazon Ads API, Sponsored Brands v3 specification (SBCreative, SBCampaignName, keywordText)", url: AMAZON_SB }],
    unverified: "The list length of 50 keywords is not from Amazon and is a soft guide.",
    bulk: { layout: "plain", note: "Plain CSV. Amazon's own bulksheet layout could not be read here." },
    costWord: "cost per order (ACOS in Amazon's report)",
  },
  {
    id: "meta-facebook-feed",
    label: "Meta, Facebook feed",
    channel: "meta",
    summary: "Primary text above the image, a headline under it, a button and a link.",
    fields: [
      { key: "primaryText", label: "Primary text", kind: "text", required: true, max: 150, shown: 125, enforce: false, note: "Meta recommends 50 to 150 characters." },
      { key: "headline", label: "Headline", kind: "text", required: true, max: 27, enforce: false, note: "Meta recommends 27 characters." },
      { key: "cta", label: "Button", kind: "text", max: 30, enforce: false },
      { key: "url", label: "Link", kind: "url", required: true, enforce: false },
    ],
    sources: [{ label: "Meta Ads Guide, image ads on Facebook Feed (text recommendations)", url: META_FB }],
    unverified: "Meta publishes these as recommendations, not as limits, so none is enforced.",
    bulk: { layout: "plain", note: "Plain CSV. Meta's bulk import template could not be read here." },
    costWord: "cost per purchase",
  },
  {
    id: "meta-instagram-feed",
    label: "Meta, Instagram feed",
    channel: "meta",
    summary: "Primary text under the image and a headline.",
    fields: [
      { key: "primaryText", label: "Primary text", kind: "text", required: true, max: 125, enforce: false, note: "Meta recommends 125 characters." },
      { key: "headline", label: "Headline", kind: "text", required: true, max: 40, enforce: false, note: "Meta recommends 40 characters." },
      { key: "cta", label: "Button", kind: "text", max: 30, enforce: false },
      { key: "url", label: "Link", kind: "url", required: true, enforce: false },
    ],
    sources: [{ label: "Meta Ads Guide, image ads on Instagram Feed (text recommendations)", url: META_IG }],
    unverified: "Meta publishes these as recommendations, not as limits, so none is enforced.",
    bulk: { layout: "plain", note: "Plain CSV. Meta's bulk import template could not be read here." },
    costWord: "cost per purchase",
  },
  {
    id: "meta-stories",
    label: "Meta, Stories (Facebook and Instagram)",
    channel: "meta",
    summary: "Full-screen vertical. Most of the message is on the image; the text here is the short line and the button.",
    fields: [
      { key: "primaryText", label: "Short line", kind: "text", required: true, max: 125, enforce: false },
      { key: "cta", label: "Button", kind: "text", max: 30, enforce: false },
      { key: "url", label: "Link", kind: "url", required: true, enforce: false },
    ],
    sources: [],
    unverified: "Meta's Stories specification page needs a browser to display and could not be read here, so no limit is sourced and the 125 characters is a soft guide.",
    bulk: { layout: "plain", note: "Plain CSV." },
    costWord: "cost per purchase",
  },
  {
    id: "x-ads",
    label: channelName("x"),
    channel: "x",
    summary: "The post text, with an optional video title and description, and a link.",
    fields: [
      { key: "postText", label: "Post text", kind: "text", required: true, max: 280, xWeight: true, enforce: true, source: X_COUNT, note: "Emoji and CJK count 2; a web address counts 23." },
      { key: "videoTitle", label: "Video title (video posts only)", kind: "text", max: 70, enforce: true, source: X_ADS },
      { key: "videoDescription", label: "Video description (video posts only)", kind: "text", max: 200, enforce: true, source: X_ADS },
      { key: "url", label: "Link", kind: "url", required: true, enforce: false },
    ],
    sources: [
      { label: "X developer documentation, counting characters", url: X_COUNT },
      { label: "X Ads API reference, video title and description", url: X_ADS },
    ],
    unverified: "X's help page on ad specifications refused automated access (403), so card headline limits could not be read.",
    bulk: { layout: "plain", note: "Plain CSV." },
    costWord: "cost per order",
  },
  {
    id: "google-search-rsa",
    label: "Google Search responsive ad",
    channel: "google",
    summary: "Up to 15 headlines and 4 descriptions that Google combines, two display path words and a final address.",
    fields: [
      { key: "headlines", label: "Headlines", kind: "list", required: true, minItems: 3, maxItems: 15, max: 30, enforce: true, source: GOOGLE },
      { key: "descriptions", label: "Descriptions", kind: "list", required: true, minItems: 2, maxItems: 4, max: 90, enforce: true, source: GOOGLE },
      { key: "path1", label: "Display path 1", kind: "text", max: 15, enforce: true, source: GOOGLE },
      { key: "path2", label: "Display path 2", kind: "text", max: 15, enforce: true, source: GOOGLE },
      { key: "finalUrl", label: "Final URL", kind: "url", required: true, enforce: true, source: GOOGLE },
    ],
    sources: [
      { label: "Google Ads Help, About responsive search ads", url: GOOGLE },
      { label: "Google Ads Editor Help, import a CSV file", url: "https://support.google.com/google-ads/editor/answer/56368" },
    ],
    unverified: "Google counts a Korean, Japanese or Chinese character as 2; this app counts every character as 1 for them.",
    bulk: {
      layout: "google-ads-editor",
      source: "https://support.google.com/google-ads/editor/answer/56368",
      note: "One ad per row with Campaign and Ad group columns, as Google Ads Editor's import page describes. The exact column names of a responsive search ad (Headline 1, Description 1, Path 1, Final URL) are the ones Editor exports and were not printed on that page: import one row first.",
    },
    costWord: "cost per conversion",
  },
  {
    id: "tiktok-ads",
    label: channelName("tiktok"),
    channel: "tiktok",
    summary: "A display name, a caption and a button over your video.",
    fields: [
      { key: "displayName", label: "Display name", kind: "text", required: true, max: 20, enforce: false, note: "TikTok's page gives 20 characters for its reservation ads; the self-serve limit was not found." },
      { key: "caption", label: "Caption", kind: "text", required: true, max: 100, enforce: false, shown: 100, note: "TikTok suggests staying within 100 characters so the caption is not covered by 'See more'; Spark Ads allow 150." },
      { key: "cta", label: "Button", kind: "choice", choices: TIKTOK_CTAS, enforce: true, source: TIKTOK_SET },
      { key: "url", label: "Landing page", kind: "url", required: true, enforce: false },
    ],
    sources: [
      { label: "TikTok Ads Manager, how to create an ad (the buttons)", url: TIKTOK_SET },
      { label: "TikTok in-feed ad specifications (display name and caption)", url: TIKTOK_SPEC },
    ],
    unverified: "TikTok's page for self-serve ads gives no caption or display name limit, so those two are soft.",
    bulk: { layout: "plain", note: "Plain CSV." },
    costWord: "cost per purchase",
  },
  {
    id: "reddit-ads",
    label: channelName("reddit"),
    channel: "reddit",
    summary: "A headline (the post's title), optional text and a button.",
    fields: [
      { key: "headline", label: "Headline", kind: "text", required: true, max: 300, enforce: false },
      { key: "body", label: "Text", kind: "text", max: 40000, enforce: false },
      { key: "cta", label: "Button", kind: "choice", choices: REDDIT_CTAS, enforce: true, source: REDDIT_API },
      { key: "url", label: "Destination", kind: "url", required: true, enforce: false },
    ],
    sources: [{ label: "Reddit Ads API v3 specification (the buttons)", url: REDDIT_API }],
    unverified: "Reddit's help pages could not be read and its API specification states no headline length, so the 300 characters of a Reddit post title is a soft guide.",
    bulk: { layout: "plain", note: "Plain CSV." },
    costWord: "cost per conversion",
  },
  {
    id: "pinterest-ads",
    label: channelName("pinterest"),
    channel: "pinterest",
    summary: "A title and a description on a Pin, and the address it opens.",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true, max: 100, shown: 40, enforce: true, source: PIN, note: "Only the first 40 characters may show in the feed." },
      { key: "description", label: "Description", kind: "text", max: 800, enforce: true, source: PIN, note: "Not shown in the feed or when the ad is viewed up close; used for relevance." },
      { key: "url", label: "Destination link", kind: "url", required: true, enforce: false },
    ],
    sources: [{ label: "Pinterest ad product specs (character counts)", url: PIN }],
    unverified: "",
    bulk: { layout: "plain", note: "Plain CSV. Pinterest's bulk upload template could not be read here." },
    costWord: "cost per order",
  },
];

export const AD_CHANNELS: ChannelSpec[] = AD_SPECS.map((s) => ({ ...s, platform: channelName(s.channel) }));

export const adChannel = (id: string) => AD_CHANNELS.find((c) => c.id === id);

// ------------------------------------------------------------------------------------------------
// Counting and checking
// ------------------------------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s]+/g;
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Length as the channel counts it. X: a web address is 23, an emoji or a CJK character is 2. */
export function measure(text: string, xWeight = false): number {
  if (!xWeight) return [...text].length;
  const withoutUrls = text.replace(URL_RE, "");
  const urls = (text.match(URL_RE) ?? []).length * 23;
  let n = urls;
  for (const ch of withoutUrls) n += EMOJI.test(ch) || WIDE.test(ch) ? 2 : 1;
  return n;
}

export type FieldValues = Record<string, string | string[] | undefined>;
export type Problem = { field: string; message: string; level: "refuse" | "warn" };

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isUrl = (s: string) => /^https?:\/\/[^\s]+\.[^\s]+$/i.test(s.trim());

/**
 * Every problem with a set of field values for a channel. "refuse" problems (a limit from the platform's
 * own page) block approval and saving; "warn" problems are shown but do not block, except
 * that a required field left empty blocks approval (see `forApproval`).
 */
export function checkChannel(spec: { fields: FieldSpec[] }, values: FieldValues, opts: { forApproval?: boolean } = {}): Problem[] {
  const out: Problem[] = [];
  for (const f of spec.fields) {
    const v = values[f.key];
    const level = f.enforce ? "refuse" : "warn";
    const list = f.kind === "list" ? (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((s) => s.trim()).filter(Boolean) : null;
    const text = f.kind !== "list" ? (typeof v === "string" ? v.trim() : "") : "";
    const empty = list ? list.length === 0 : text === "";
    if (empty) {
      if (f.required && opts.forApproval) out.push({ field: f.key, message: `${f.label} is required.`, level: "refuse" });
      continue;
    }
    if (list) {
      if (f.maxItems !== undefined && list.length > f.maxItems) out.push({ field: f.key, message: `${f.label}: ${list.length} items, the limit is ${f.maxItems}.`, level });
      if (f.minItems !== undefined && list.length < f.minItems && opts.forApproval) out.push({ field: f.key, message: `${f.label}: at least ${f.minItems} needed, ${list.length} given.`, level: "refuse" });
      list.forEach((item, i) => {
        const n = measure(item, f.xWeight);
        if (f.max !== undefined && n > f.max) out.push({ field: f.key, message: `${f.label} ${i + 1}: ${n} characters, the limit is ${f.max}.`, level });
        if (f.maxWords !== undefined && words(item) > f.maxWords) out.push({ field: f.key, message: `${f.label} ${i + 1}: ${words(item)} words, the limit is ${f.maxWords}.`, level });
      });
      continue;
    }
    if (f.kind === "choice") {
      if (f.choices && !f.choices.includes(text)) out.push({ field: f.key, message: `${f.label}: "${text}" is not one of ${f.choices.join(", ")}.`, level });
      continue;
    }
    if (f.kind === "url") {
      if (!isUrl(text)) out.push({ field: f.key, message: `${f.label}: not a web address (it must start with https://).`, level: f.enforce ? "refuse" : "warn" });
      continue;
    }
    const n = measure(text, f.xWeight);
    if (f.max !== undefined && n > f.max) out.push({ field: f.key, message: `${f.label}: ${n} characters, the limit is ${f.max}${f.enforce ? "" : " (a guide, not a platform limit)"}.`, level });
    if (f.min !== undefined && n < f.min) out.push({ field: f.key, message: `${f.label}: ${n} characters, at least ${f.min} are expected.`, level: "warn" });
    if (f.maxWords !== undefined && words(text) > f.maxWords) out.push({ field: f.key, message: `${f.label}: ${words(text)} words, the limit is ${f.maxWords}.`, level });
  }
  return out;
}

export const refusals = (p: Problem[]) => p.filter((x) => x.level === "refuse");

// ------------------------------------------------------------------------------------------------
// Social posts
// ------------------------------------------------------------------------------------------------

export type SocialSpec = {
  id: string;
  label: string;
  /** characters of the post text */
  max: number;
  enforce: boolean;
  xWeight?: boolean;
  /** second text field (a title) when the channel has one */
  title?: { max: number; enforce: boolean };
  source?: string;
  note: string;
};

const SOCIAL_LIMITS: Record<string, Omit<SocialSpec, "id" | "label">> = {
  x: { max: 280, enforce: true, xWeight: true, source: X_COUNT, note: "Emoji and CJK count 2; a web address counts 23." },
  instagram: { max: 2200, enforce: false, note: "2,200 is Instagram's caption length as generally published; Instagram's own help page could not be read here, so it is a soft guide." },
  facebook: { max: 2000, enforce: false, note: "Facebook publishes no short limit for a Page post; 2,000 is a soft guide for reading length." },
  pinterest: { max: 800, enforce: true, title: { max: 100, enforce: true }, source: PIN, note: "Title 100 characters (the first 40 may show) and description 800." },
  tiktok: { max: 150, enforce: false, source: TIKTOK_SPEC, note: "150 is the caption length TikTok gives for Spark Ads; for a plain post it is a soft guide." },
  reddit: { max: 300, enforce: false, title: { max: 300, enforce: false }, note: "Reddit's help pages could not be read; 300 is a post title's usual limit and a soft guide." },
  linkedin: { max: 3000, enforce: false, note: "3,000 is LinkedIn's post length as generally published; its help page could not be read here, so it is a soft guide." },
};

export const SOCIAL_CHANNELS: SocialSpec[] = channelsWith("social").map((c) => ({ id: c.id, label: c.name, ...SOCIAL_LIMITS[c.id] }));

/** By id ("x") or by the name the board shows ("X"), any case. */
export const socialChannel = (id: string) => SOCIAL_CHANNELS.find((c) => c.id === id.toLowerCase() || c.label.toLowerCase() === id.toLowerCase());

export function checkSocial(spec: SocialSpec, text: string, title = ""): Problem[] {
  const out: Problem[] = [];
  const n = measure(text, spec.xWeight);
  if (n > spec.max) out.push({ field: "text", message: `${n} characters, the limit is ${spec.max}${spec.enforce ? "" : " (a guide, not a platform limit)"}.`, level: spec.enforce ? "refuse" : "warn" });
  if (spec.title && title) {
    const t = measure(title);
    if (t > spec.title.max) out.push({ field: "title", message: `Title: ${t} characters, the limit is ${spec.title.max}.`, level: spec.title.enforce ? "refuse" : "warn" });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Amazon listing
// ------------------------------------------------------------------------------------------------

const AMAZON_DETAIL_PDF = "https://m.media-amazon.com/images/G/31/02/RW32A65AJD._CB467907754_.pdf";
const SELLER_PESTICIDE = "https://sellercentral.amazon.com/forums/t/reminder-action-required-for-listings-on-amazon-classified-as-pesticides/753908";
const SELLER_CLAIMS = "https://sellercentral.amazon.com/gp/help/G202115120";

type ListingLimits = {
  title: { max: number; enforce: boolean; source?: string };
  bullets: { count: number; max: number; enforce: boolean; source?: string };
  description: { max: number; enforce: boolean; source?: string };
  searchTerms: { maxBytes: number; enforce: boolean; source?: string };
};

export type ListingCategory = { id: string; label: string; limits: ListingLimits; note: string };

const baseLimits: ListingLimits = {
  title: { max: 200, enforce: true, source: AMAZON_DETAIL_PDF },
  bullets: { count: 5, max: 500, enforce: false },
  description: { max: 2000, enforce: true, source: AMAZON_DETAIL_PDF },
  searchTerms: { maxBytes: 250, enforce: false },
};

export const LISTING_CATEGORIES: ListingCategory[] = [
  { id: "default", label: "Most categories", limits: baseLimits, note: "Title under 200 characters and description 2,000 characters are from Amazon's 'Understanding the detail page' guide (the PDF it hosts). Five bullets is its 'top five features'. The 500 characters a bullet and 250 bytes of search terms are Amazon's usual limits but could not be read on Seller Central here, so they are soft." },
  { id: "electronics", label: "Electronics", limits: baseLimits, note: "Same limits as most categories." },
  { id: "home", label: "Home and kitchen", limits: baseLimits, note: "Same limits as most categories." },
  { id: "toys", label: "Toys and games", limits: baseLimits, note: "Same limits as most categories." },
  { id: "clothing", label: "Clothing and accessories", limits: { ...baseLimits, title: { max: 80, enforce: false } }, note: "Amazon has asked for shorter titles in apparel (80 characters is widely reported); Seller Central's page could not be read here, so the 80 is a soft guide." },
  { id: "beauty", label: "Beauty and personal care", limits: { ...baseLimits, title: { max: 200, enforce: true, source: AMAZON_DETAIL_PDF } }, note: "Same limits as most categories; claims here are checked closely (see the warnings)." },
];

export const listingCategory = (id: string) => LISTING_CATEGORIES.find((c) => c.id === id) ?? LISTING_CATEGORIES[0];

type ListingRule = { id: string; label: string; pattern: RegExp; message: string; source: string; sourceNote: string };

/** Claims Amazon documents as not allowed or as needing registration. These are warnings: the writer decides. */
const LISTING_RULES: ListingRule[] = [
  {
    id: "pesticide",
    label: "Pesticidal claim",
    pattern: /\b(disinfect\w*|sanitis\w*|sanitiz\w*|kills?\s+(?:germs|bacteria|viruses|mould|mold|insects|bugs)|repels?\s+(?:insects|mosquito\w*|bugs|rodents|pests)|antibacterial|anti-bacterial|antimicrobial|antiviral|antifungal|bacteria[- ]free|germ[- ]free|removes?\s+allergens|allergen[- ]free)\b/i,
    message: "Amazon treats products marketed to disinfect, repel insects, remove allergens or prevent bacteria, or that make antiviral, antimicrobial, antifungal or antibacterial claims, as pesticides or pesticide devices. They need an EPA number or an exemption, and Amazon's approval.",
    source: SELLER_PESTICIDE,
    sourceNote: "Amazon Seller Central announcement on pesticide listings (public forum post by Amazon).",
  },
  {
    id: "medical",
    label: "Medical claim",
    pattern: /\b(cures?|heals?|treats?|prevents?\s+(?:disease|cancer|diabetes|infection)|diagnos\w*|clinically\s+proven|FDA[- ](?:approved|cleared)|relieves?\s+pain|reduces?\s+(?:inflammation|anxiety|depression)|therapeutic|medical[- ]grade)\b/i,
    message: "Claims that a product cures, treats, prevents or diagnoses a condition, or that it is approved by a regulator, are prohibited unless the product is legitimately cleared for them, and a claim needs proof.",
    source: SELLER_CLAIMS,
    sourceNote: "Amazon's prohibited product claims policy. The page needs a seller login and could not be read here: the word list is this app's, the policy is the source.",
  },
  {
    id: "promo",
    label: "Price or promotion",
    pattern: /(\bfree\s+ship\w*|\bon\s+sale\b|\bsale\b|\bdiscount\w*|\bcheapest\b|\blowest\s+price\b|\bbest\s+price\b|\bwarranty\s+void\b|[$£€]\s?\d)/i,
    message: "Titles, bullets and descriptions must not include prices, promotional messages such as 'sale' or 'free shipping', or shipping information.",
    source: AMAZON_DETAIL_PDF,
    sourceNote: "Amazon's 'Understanding the detail page' guide: 'Do not include promotional messages, such as sale or free ship' and 'Do not include price and quantity'.",
  },
  {
    id: "subjective",
    label: "Subjective claim",
    pattern: /\b(best[- ]sell\w*|hot\s+item|amazon'?s\s+choice|#\s?1|number\s+one|top[- ]rated|award[- ]winning|guaranteed)\b/i,
    message: "Do not include subjective commentary such as 'Hot Item' or 'Best Seller', or claim Amazon's badges.",
    source: AMAZON_DETAIL_PDF,
    sourceNote: "Amazon's 'Understanding the detail page' guide: 'Do not include subjective commentary, such as Hot Item, or Best Seller'.",
  },
  {
    id: "company",
    label: "Company or seller information",
    pattern: /\b(our\s+company|our\s+store|visit\s+our|contact\s+us|email\s+us|call\s+us|www\.[a-z0-9-]+\.[a-z]{2,}|https?:\/\/)/i,
    message: "Bullets and descriptions are for product features only: no seller, company, contact or shipping information.",
    source: AMAZON_DETAIL_PDF,
    sourceNote: "Amazon's 'Understanding the detail page' guide: 'Amazon policy prohibits including seller, company, or shipping information'.",
  },
];

export type ListingFields = { title: string; bullets: string[]; description: string; searchTerms: string };
export type ListingProblem = Problem & { rule?: string; source?: string };

const bytes = (s: string) => Buffer.byteLength(s, "utf8");

export function checkListing(category: ListingCategory, f: ListingFields, opts: { forApproval?: boolean } = {}): ListingProblem[] {
  const out: ListingProblem[] = [];
  const L = category.limits;
  const lvl = (enforce: boolean) => (enforce ? ("refuse" as const) : ("warn" as const));
  const t = [...f.title].length;
  if (t > L.title.max) out.push({ field: "title", message: `Title: ${t} characters, the limit is ${L.title.max}${L.title.enforce ? "" : " (a guide)"}.`, level: lvl(L.title.enforce), source: L.title.source });
  const bullets = f.bullets.map((b) => b.trim()).filter(Boolean);
  if (bullets.length > L.bullets.count) out.push({ field: "bullets", message: `${bullets.length} bullets, the limit is ${L.bullets.count}.`, level: lvl(true), source: AMAZON_DETAIL_PDF });
  bullets.forEach((b, i) => {
    const n = [...b].length;
    if (n > L.bullets.max) out.push({ field: `bullet${i + 1}`, message: `Bullet ${i + 1}: ${n} characters, the guide is ${L.bullets.max}.`, level: lvl(L.bullets.enforce) });
  });
  const d = [...f.description].length;
  if (d > L.description.max) out.push({ field: "description", message: `Description: ${d} characters, the limit is ${L.description.max}.`, level: lvl(L.description.enforce), source: L.description.source });
  const sb = bytes(f.searchTerms);
  if (sb > L.searchTerms.maxBytes) out.push({ field: "searchTerms", message: `Search terms: ${sb} bytes, the guide is ${L.searchTerms.maxBytes}.`, level: lvl(L.searchTerms.enforce) });
  if (opts.forApproval) {
    if (!f.title.trim()) out.push({ field: "title", message: "A title is required.", level: "refuse" });
    if (bullets.length < 1) out.push({ field: "bullets", message: "At least one bullet is required.", level: "refuse" });
  }
  const parts: [string, string][] = [["title", f.title], ...bullets.map((b, i): [string, string] => [`bullet${i + 1}`, b]), ["description", f.description], ["searchTerms", f.searchTerms]];
  for (const [field, text] of parts) {
    for (const r of LISTING_RULES) {
      const m = r.pattern.exec(text);
      if (m) out.push({ field, message: `${r.label}: "${m[0]}". ${r.message}`, level: "warn", rule: r.id, source: r.source });
    }
  }
  return out;
}
