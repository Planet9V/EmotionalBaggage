// Admin, Other services: every environment variable the app reads, whether it is set, and what it does. Only the
// database connection is required (docker-compose.yml supplies it to the containers); everything else is an
// optional override of a value that is normally entered in Admin. Values are never shown, except addresses.
import { ENV_FALLBACK } from "@/lib/settings";

export type EnvLine = {
  name: string;
  set: boolean;
  /** an address that is safe to show; null for anything secret or not set */
  value: string | null;
  kind: "required" | "override" | "deployment";
  does: string;
};

type Def = { name: string; kind: EnvLine["kind"]; does: string; address?: boolean };

const DEFS: Def[] = [
  { name: "DATABASE_URL", kind: "required", does: "The PostgreSQL connection. Every setting, key and file is stored there. Docker Compose supplies it." },
  { name: "DATABASE_APP_URL", kind: "deployment", does: "A second database role for requests, with fewer rights. Docker Compose supplies it." },
  { name: "PLANNER_URL", kind: "override", does: "The planner's address when none is saved in Admin. Docker Compose sets it to its planner service.", address: true },
  { name: "SLICER_URL", kind: "override", does: "The slicer's address when none is saved in Admin, Printers.", address: true },
  { name: "PRINTER_KIND", kind: "override", does: "A printer kind used only when no printer is added in Admin, Printers." },
  { name: "PRINTER_URL", kind: "override", does: "That printer's address.", address: true },
  { name: "PRINTER_API_KEY", kind: "override", does: "That printer's key." },
  { name: "PERPLEXITY_BASE_URL", kind: "override", does: "Another address for the research service (normally left out).", address: true },
  { name: "AMAZON_LWA_TOKEN_URL", kind: "override", does: "Another address for Amazon's sign-in service (normally left out).", address: true },
  { name: "AMAZON_SP_BASE_URL", kind: "override", does: "Another address for the Amazon Selling Partner API (normally left out).", address: true },
  { name: "X_API_BASE_URL", kind: "override", does: "Another address for the X API (normally left out).", address: true },
  { name: "X_AUTHORIZE_URL", kind: "override", does: "Another address for X's sign-in page (normally left out).", address: true },
  { name: "INSTAGRAM_GRAPH_BASE_URL", kind: "override", does: "Another address for the Instagram API (normally left out).", address: true },
  { name: "AUTH2", kind: "deployment", does: "Turns on the new sign-in with accounts (being built)." },
  { name: "BETTER_AUTH_SECRET", kind: "deployment", does: "The new sign-in's signing secret, used only when it is on." },
  { name: "BETTER_AUTH_URL", kind: "deployment", does: "The address the new sign-in is reached at.", address: true },
  { name: "AUTH2_TRUSTED_ORIGINS", kind: "deployment", does: "Other addresses the new sign-in accepts." },
  { name: "TRUST_PROXY", kind: "deployment", does: "Read the visitor's address from a reverse proxy in front." },
  { name: "TRUSTED_PROXIES", kind: "deployment", does: "The addresses of those proxies." },
  { name: "PORT", kind: "deployment", does: "The port the app listens on." },
  { name: "ROUTE_PLANNER_SECONDS", kind: "deployment", does: "How long the wire router may run." },
];

/** Keys that are only read when nothing is saved in Admin (src/lib/settings.ts). */
const KEY_DEFS: Def[] = Object.entries(ENV_FALLBACK).map(([field, name]) => ({ name, kind: "override", does: `The ${field.replace(".", " ")} when none is saved in Admin.` }));

export function environmentReport(): EnvLine[] {
  return [...DEFS.slice(0, 2), ...KEY_DEFS, ...DEFS.slice(2)].map((d) => {
    const v = process.env[d.name]?.trim() ?? "";
    let shown: string | null = null;
    if (v && d.address) {
      try {
        const u = new URL(v);
        shown = u.username || u.password ? null : u.toString().replace(/\/+$/, "");
      } catch {
        shown = null;
      }
    }
    return { name: d.name, set: !!v, value: shown, kind: d.kind, does: d.does };
  });
}
