// Search links for the distributors a prototype uses. The user follows them; the app does not fetch, scrape or buy.
// Each pattern is the distributor's own public search address as of 21 Nov 2026. None was opened by the program that wrote this
// list (see the report): if one stops working, only this table changes.

export type Distributor = { id: string; label: string; url: (term: string) => string; for: string };

const q = encodeURIComponent;

export const DISTRIBUTORS: Distributor[] = [
  { id: "digikey", label: "Digi-Key", for: "electronic parts", url: (t) => `https://www.digikey.com/en/products/result?keywords=${q(t)}` },
  { id: "mouser", label: "Mouser", for: "electronic parts", url: (t) => `https://www.mouser.com/c/?q=${q(t)}` },
  { id: "lcsc", label: "LCSC", for: "electronic parts, low volume", url: (t) => `https://www.lcsc.com/search?q=${q(t)}` },
  { id: "adafruit", label: "Adafruit", for: "modules and breakouts", url: (t) => `https://www.adafruit.com/search?q=${q(t)}` },
  { id: "sparkfun", label: "SparkFun", for: "modules and breakouts", url: (t) => `https://www.sparkfun.com/search/results?term=${q(t)}` },
  { id: "amazon", label: "Amazon", for: "anything in small packs", url: (t) => `https://www.amazon.com/s?k=${q(t)}` },
  { id: "aliexpress", label: "AliExpress", for: "cheap modules, long lead time", url: (t) => `https://www.aliexpress.com/wholesale?SearchText=${q(t)}` },
  { id: "mcmaster", label: "McMaster-Carr", for: "hardware: screws, inserts, springs", url: (t) => `https://www.mcmaster.com/${q(t.toLowerCase().replace(/\s+/g, "-"))}/` },
];

/** The words to search for: the part number when there is one, else the part's search term, else its name. */
export function searchTerm(part: { title: string; search?: string; partNumber?: string }): string {
  return (part.partNumber || part.search || part.title).trim().replace(/\s+/g, " ");
}

export const searchLinks = (term: string) => DISTRIBUTORS.map((d) => ({ id: d.id, label: d.label, for: d.for, url: d.url(term) }));
