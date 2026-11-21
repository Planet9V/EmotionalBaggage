// The screening checklist for a name or a tagline. The app builds search links from the text and
// the person follows them and ticks what they checked. It never performs or reads a search, and
// it never says that a name is available or clear: SCREENING_NOTE is shown on the page.

export const SCREENING_NOTE =
  "These links open search pages so you can run the checks yourself. They are a prompt for your own checks, not a clearance: this app does not run the searches and cannot say a name is available.";

export type CheckGroup = "domain" | "marketplace" | "app stores" | "trademark" | "social";

export type NameCheck = { id: string; group: CheckGroup; label: string; href: string };

const enc = encodeURIComponent;

/** letters and digits only, lower case: what a domain or a social handle can be built from */
export function handleOf(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The checks for one name. A tagline is a phrase, so it gets the phrase searches (marketplaces,
 * trademark) and no domain or handle checks.
 */
export function nameChecks(text: string, kind: "Name" | "Tagline" = "Name"): NameCheck[] {
  const t = text.trim();
  if (!t) return [];
  const q = enc(t);
  const phrase = enc(`"${t}"`);
  const out: NameCheck[] = [];
  const h = handleOf(t);

  if (kind === "Name" && h) {
    out.push(
      { id: "domain-search", group: "domain", label: "Search .com and other endings (Namecheap)", href: `https://www.namecheap.com/domains/registration/results/?domain=${enc(h)}` },
      { id: "domain-whois", group: "domain", label: `Look up ${h}.com (who.is)`, href: `https://who.is/whois/${enc(h)}.com` },
    );
  }
  out.push(
    { id: "amazon", group: "marketplace", label: "Search Amazon", href: `https://www.amazon.com/s?k=${q}` },
    { id: "etsy", group: "marketplace", label: "Search Etsy", href: `https://www.etsy.com/search?q=${q}` },
  );
  if (kind === "Name") {
    out.push(
      { id: "app-apple", group: "app stores", label: "Search the App Store (through a web search)", href: `https://www.google.com/search?q=${enc(`site:apps.apple.com ${t}`)}` },
      { id: "app-google", group: "app stores", label: "Search Google Play", href: `https://play.google.com/store/search?q=${q}&c=apps` },
    );
  }
  out.push(
    { id: "tm-uspto", group: "trademark", label: "USPTO trademark search (paste the name there)", href: "https://tmsearch.uspto.gov/search/search-information" },
    { id: "tm-euipo", group: "trademark", label: "EUIPO eSearch plus", href: `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/50+50+50+50/${q}` },
    { id: "tm-wipo", group: "trademark", label: "WIPO Global Brand Database", href: `https://branddb.wipo.int/en/quicksearch?by=brandName&v=${q}&rows=30&sort=score%20desc&start=0` },
    { id: "web", group: "trademark", label: "Web search for the exact phrase", href: `https://www.google.com/search?q=${phrase}` },
  );
  if (kind === "Name" && h) {
    out.push(
      { id: "social-instagram", group: "social", label: `Instagram @${h}`, href: `https://www.instagram.com/${enc(h)}/` },
      { id: "social-x", group: "social", label: `X @${h}`, href: `https://x.com/${enc(h)}` },
      { id: "social-tiktok", group: "social", label: `TikTok @${h}`, href: `https://www.tiktok.com/@${enc(h)}` },
      { id: "social-youtube", group: "social", label: `YouTube @${h}`, href: `https://www.youtube.com/@${enc(h)}` },
    );
  }
  return out;
}

export const GROUP_ORDER: CheckGroup[] = ["domain", "marketplace", "app stores", "trademark", "social"];
export const GROUP_LABEL: Record<CheckGroup, string> = {
  domain: "Domain",
  marketplace: "Marketplaces",
  "app stores": "App stores (if it will be an app)",
  trademark: "Trademark and the open web",
  social: "Social handles",
};

/** How many of a name's checks are ticked, out of how many. */
export function screeningProgress(checks: NameCheck[], ticked: Record<string, boolean> | undefined) {
  const done = checks.filter((c) => ticked?.[c.id]).length;
  return { done, total: checks.length };
}
