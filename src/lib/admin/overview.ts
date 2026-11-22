// Admin, Overview: for every outside service, one status line (configured / not configured / configured but
// failing), when it was last checked, where its values come from, and what in the app is switched off without it.
// This is the "nothing is a blocker" page: every service is optional and every line says what still works.
// It makes no outbound call except the planner's own quick health read (as the first-run checklist does); the
// other services show the result of their last "Test connection".
import { ready } from "@/lib/db";
import { credentialSource, type Provider } from "@/lib/settings";
import { PROVIDER_DEFS } from "./providers";
import { providerView } from "./credentials";
import { readChecks, type LastCheck, type ServiceKey } from "./checks";
import { firstRunStatus } from "./status";
import { plannerAddress, plannerHealth } from "./planner";
import { slicerAddress } from "@/lib/slicing/config";
import { getStripeSettings } from "./stripe";
import { getMailSender, readMailSettings } from "./mail";
import { getVoiceSettings } from "@/lib/voice/speech";
import { getPlanCatalogue } from "./plans";

type Source = "database" | "environment" | "mixed" | "built-in" | null;

export type ServiceStatus = {
  key: ServiceKey | "pricing";
  label: string;
  /** the Admin section (?tab=) where it is set */
  tab: string;
  state: "configured" | "not-configured" | "failing";
  /** the current state, in one sentence */
  summary: string;
  source: Source;
  lastCheck: LastCheck | null;
  /** what is switched off while it is not configured (or what it changes), in one sentence */
  without: string;
};

const fromCred = (s: "admin" | "environment" | null): Source => (s === "admin" ? "database" : s);

async function providerSource(id: Provider): Promise<Source> {
  const def = PROVIDER_DEFS.find((p) => p.id === id)!;
  const all = await Promise.all(def.fields.map((f) => credentialSource(id, f.name)));
  const set = new Set(all.filter(Boolean).map((s) => fromCred(s)));
  return set.size === 0 ? null : set.size > 1 ? "mixed" : [...set][0]!;
}

/** configured, unless the last test after the last change failed. */
function stateOf(configured: boolean, last: LastCheck | null | undefined): ServiceStatus["state"] {
  if (!configured) return "not-configured";
  return last && !last.ok ? "failing" : "configured";
}

/** The new powers' lines (src/lib/admin/guard.ts): anyone but the platform administrator sees only configured or not (review F5). */
const NEW_POWERS = new Set<ServiceStatus["key"]>(["payments", "email", "voice"]);

export async function serviceOverview(viewer: { platformAdmin: boolean }): Promise<ServiceStatus[]> {
  const [checks, first, stripe, stripeSrc, mail, mailSettings, mailPw, voice, amazon, x, instagram, amazonSrc, xSrc, igSrc, planner, health, slicer, db, catalogue] = await Promise.all([
    readChecks(),
    firstRunStatus(),
    getStripeSettings(),
    providerSource("stripe"),
    getMailSender(),
    readMailSettings(),
    credentialSource("smtp", "password"),
    getVoiceSettings(),
    providerView("amazon-sp", viewer),
    providerView("x", viewer),
    providerView("instagram", viewer),
    providerSource("amazon-sp"),
    providerSource("x"),
    providerSource("instagram"),
    plannerAddress(),
    plannerHealth(),
    slicerAddress(),
    ready(),
    getPlanCatalogue(),
  ]);
  const item = (k: string) => first.items.find((i) => i.key === k)!;
  const out: ServiceStatus[] = [];
  const add = (s: Omit<ServiceStatus, "lastCheck" | "state"> & { configured: boolean; failing?: boolean }) => {
    const lastCheck = s.key === "pricing" ? null : (checks[s.key] ?? null);
    const { configured, failing, ...rest } = s;
    const state = failing ? "failing" : stateOf(configured, lastCheck);
    if (!viewer.platformAdmin && NEW_POWERS.has(s.key)) {
      out.push({ ...rest, summary: configured ? "Set up by the platform administrator." : "Not set up.", lastCheck: null, state });
      return;
    }
    out.push({ ...rest, lastCheck, state });
  };

  add({
    key: "payments", label: "Payments (Stripe)", tab: "payments", configured: stripe.configured, source: stripeSrc,
    summary: stripe.configured ? `Set up with ${stripe.mode} keys${stripe.webhookSecret ? "" : "; no webhook signing secret yet"}.` : stripe.reason,
    without: "Nothing can be bought: the public page's levels ask for access instead. Everything else works.",
  });
  add({
    key: "email", label: "Email", tab: "email", configured: mail.configured,
    source: mailSettings.mode === "smtp" ? (mailPw === "environment" ? "mixed" : "database") : null,
    summary: mail.configured ? `Sends through ${mail.server} as ${mail.from.address}.` : mail.reason,
    without: "No email is sent: sign-up confirmations, password resets and invitations wait. Sign-in with an existing password works.",
  });
  const reasoning = item("reasoningModel");
  add({ key: "reasoningModel", label: "Reasoning model", tab: "models", configured: reasoning.configured, source: reasoning.configured ? "database" : null, summary: reasoning.state, without: "Drafting, the reviewer and chat are off; every page can still be filled in by hand." });
  const embedding = item("embeddingModel");
  const vector = first.items.find((i) => i.key === "vectorStore");
  add({
    key: "embeddingModel", label: "Embedding model", tab: "models", configured: embedding.configured, failing: embedding.configured && !!vector, source: embedding.configured ? "database" : null,
    summary: vector ? `${embedding.state} ${vector.state}` : embedding.state,
    without: "Search matches words only, not meaning.",
  });
  const research = item("research");
  add({ key: "research", label: "Research (Perplexity)", tab: "models", configured: research.configured, source: fromCred(await credentialSource("perplexity", "apiKey")), summary: research.state, without: "Research, Ask is off; sources can still be added by hand." });
  add({
    key: "voice", label: "Voice", tab: "voice", configured: voice.configured, source: voice.configured ? "database" : null,
    summary: voice.configured ? `${voice.provider === "elevenlabs" ? "ElevenLabs" : "Speech endpoint"}, voice ${voice.voice}, speed ${voice.speed}.` : voice.reason,
    without: "Narration is off; nothing else uses a voice.",
  });
  const channel = (key: "amazon" | "x" | "instagram", label: string, v: typeof amazon, src: Source, without: string) =>
    add({ key, label, tab: "channels", configured: v.configured, source: src, summary: v.configured ? "The required values are saved." : `Not connected: ${v.fields.filter((f) => f.required && !f.set).map((f) => f.label.toLowerCase()).join(", ")} missing.`, without });
  channel("amazon", "Amazon Seller Central", amazon, amazonSrc, "Sales monitor shows no Amazon orders; you can still enter sales by hand.");
  channel("x", "X", x, xSrc, "Posting to X and reading mentions are off; drafts can be copied by hand.");
  channel("instagram", "Instagram", instagram, igSrc, "Publishing to Instagram and reading comments are off; drafts can be copied by hand.");
  const printers = item("printer");
  add({ key: "printers", label: "Printers", tab: "printers", configured: printers.configured, source: printers.configured ? (/environment/.test(printers.state) ? "environment" : "database") : null, summary: printers.state, without: "No live print status; sliced files can still be downloaded and printed by hand." });
  add({
    key: "planner", label: "Planner", tab: "services", configured: !!planner.url, failing: !!planner.url && !health.connected, source: fromCred(planner.source),
    summary: !planner.url ? "No planner address." : health.connected ? `Reachable at ${planner.url}.` : `Not reachable at ${planner.url}: ${health.error ?? "no answer"}.`,
    without: "The order of operations, critical path and wiring harness are not worked out; the rows themselves still show.",
  });
  add({ key: "slicer", label: "Slicer", tab: "services", configured: !!slicer.url, source: fromCred(slicer.source), summary: slicer.url ? `At ${slicer.url}.` : "No slicer address.", without: "Print time and material are not worked out; you can slice in your own slicer and upload the file." });
  add({
    key: "database", label: "Database", tab: "services", configured: true, failing: !!db.vectorProblem, source: "environment",
    summary: db.vectorProblem ? `Connected. Search by meaning is off: ${db.vectorProblem}` : db.vector ? "Connected, with pgvector." : "Connected, without pgvector: search matches words only.",
    without: "Every setting and key on these pages is stored here.",
  });
  add({
    key: "pricing", label: "Pricing and tiers", tab: "pricing", configured: true, source: catalogue.source,
    summary: `${catalogue.catalogue.tiers.filter((t) => t.shown).length} of ${catalogue.catalogue.tiers.length} tiers shown on the public page; prices ${catalogue.catalogue.showPrices ? "shown" : "hidden"}.${catalogue.source === "built-in" ? " The built-in catalogue applies until one is saved." : ""}${catalogue.problem ? ` ${catalogue.problem}` : ""}`,
    without: "Always has a catalogue: the built-in one until one is saved.",
  });
  return out;
}
