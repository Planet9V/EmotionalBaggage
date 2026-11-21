// The hosts a concept's tracked links may open (robustness review S5). Pure, so the browser can use it.
import { HOST_RE } from "./schemas";

export { HOST_RE };

/** Reads "shop.example, www.amazon.com" (commas, spaces or new lines) into host names; bad entries are returned apart. */
export function parseHosts(text: string): { hosts: string[]; bad: string[] } {
  const hosts: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    let h = raw.trim().toLowerCase();
    if (!h) continue;
    h = h.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
    if (HOST_RE.test(h)) {
      if (!hosts.includes(h)) hosts.push(h);
    } else bad.push(raw.trim());
  }
  return { hosts, bad };
}

/** True when the host is on the list, or is a sub-domain of a host on it ("shop.example" allows "www.shop.example"). */
export function hostAllowed(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

