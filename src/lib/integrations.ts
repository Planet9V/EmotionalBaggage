// One place that says what is connected. Nothing here pretends:
// an integration is "connected" only when its credentials or settings are present (saved in Admin, or
// still given by an environment variable), and "built" only when this prototype actually calls the service.
import { q } from "@/lib/db";
import { credentialSource, embeddingModel, reasoningModel, type ModelChoice, type Provider } from "@/lib/settings";
import { printerFamily } from "@/lib/admin/printerFamilies";

export type Source = "admin" | "environment" | "mixed" | null;

export type Integration = {
  key: string;
  name: string;
  purpose: string;
  /** environment variables still honoured when Admin has nothing saved */
  env: string[];
  configured: boolean;
  /** does this prototype contain working call code for it? */
  built: "yes" | "partial" | "no";
  note: string;
  /** where the values in use come from: saved in Admin, the environment, a mix, or nowhere */
  source: Source;
  /** the part of Admin where this is set: credentials, settings or printers; null when there is nothing to set */
  admin: "credentials" | "settings" | "printers" | null;
};

/** Every listed field present, and where they come from. */
async function credentials(provider: Provider, fields: string[]): Promise<{ configured: boolean; source: Source }> {
  const sources = await Promise.all(fields.map((f) => credentialSource(provider, f)));
  const configured = sources.every((s) => s !== null);
  const present = new Set(sources.filter((s) => s !== null));
  const source: Source = present.size === 0 ? null : present.size > 1 ? "mixed" : [...present][0]!;
  return { configured, source };
}

/** A model choice counts as configured when it is saved and, for OpenRouter, a key is present. */
async function model(choice: ModelChoice | null): Promise<{ configured: boolean; source: Source; note: string }> {
  if (!choice) return { configured: false, source: null, note: "No model chosen in Admin." };
  const where = `${choice.model} on ${choice.provider} at ${choice.baseUrl}`;
  if (choice.provider === "openrouter" && (await credentialSource("openrouter", "apiKey")) === null) {
    return { configured: false, source: "admin", note: `${where}, but no OpenRouter key is saved.` };
  }
  return { configured: true, source: "admin", note: `${where}.` };
}

async function printer(): Promise<{ configured: boolean; source: Source; note: string }> {
  const rows = await q<{ n: number; first: string | null; family: string | null }>(
    "SELECT count(*)::int AS n, (array_agg(name ORDER BY id))[1] AS first, (array_agg(family ORDER BY id))[1] AS family FROM printers WHERE enabled"
  );
  const { n, first, family } = rows[0];
  if (n > 0) {
    const label = printerFamily(family ?? "")?.label ?? family;
    return { configured: true, source: "admin", note: `${n} printer${n === 1 ? "" : "s"} in Admin; status shows the first, ${first} (${label}).` };
  }
  if (process.env.PRINTER_KIND && process.env.PRINTER_URL) {
    return { configured: true, source: "environment", note: `No printer in Admin; using PRINTER_KIND=${process.env.PRINTER_KIND} from the environment.` };
  }
  return { configured: false, source: null, note: "No printer added in Admin." };
}

export async function listIntegrations(): Promise<Integration[]> {
  const [reasoning, embedding, perplexity, amazon, x, instagram, printers] = await Promise.all([
    reasoningModel().then(model),
    embeddingModel().then(model),
    credentials("perplexity", ["apiKey"]),
    credentials("amazon-sp", ["refreshToken", "clientId", "clientSecret"]),
    credentials("x", ["accessToken"]),
    credentials("instagram", ["accessToken", "accountId"]),
    printer(),
  ]);
  return [
    {
      key: "reasoning-model",
      name: "Reasoning model",
      purpose: "The reviewer, chat, and every drafted row: requirements, parts, wiring, assembly, tests, optimisation, marketing content, campaign plans and replies.",
      env: [],
      configured: reasoning.configured,
      built: "yes",
      note: `${reasoning.note} Used by Concept → Challenge, Chat, and every Draft button; each draft waits for your approval. Not yet run against a real Ollama, LM Studio or OpenRouter.`,
      source: reasoning.source,
      admin: "settings",
    },
    {
      key: "embedding-model",
      name: "Embedding model",
      purpose: "Search by meaning across rows and research.",
      env: [],
      configured: embedding.configured,
      built: "yes",
      note: `${embedding.note} Rows and research answers are embedded with "Index the current concept" in Admin, Models, after saving the model, and searched by meaning in Search and Chat. Needs pgvector in the database. Not yet run against a real model host.`,
      source: embedding.source,
      admin: "settings",
    },
    {
      key: "perplexity",
      name: "Perplexity",
      purpose: "Research → Ask: web research with citations.",
      env: ["PERPLEXITY_API_KEY"],
      configured: perplexity.configured,
      built: "yes",
      note: "Calls POST https://api.perplexity.ai/v1/agent. Not yet run against a live key.",
      source: perplexity.source,
      admin: "credentials",
    },
    {
      key: "printer",
      name: "3D printer",
      purpose: "Prototype → 3D printing: live status, sending a sliced file, and starting, pausing and cancelling a print.",
      env: ["PRINTER_KIND", "PRINTER_URL"],
      configured: printers.configured,
      built: "yes",
      note: `${printers.note} Status, sending files, start, pause, resume and cancel for OctoPrint, Klipper (Moonraker), PrusaLink, Duet and Bambu Lab; Creality and Elegoo Klipper machines are experimental. Start and cancel need a confirmation that names the printer and the file. Checked against stand-ins; not yet run against a real printer.`,
      source: printers.source,
      admin: "printers",
    },
    {
      key: "amazon-buy",
      name: "Amazon purchasing",
      purpose: "Prototype → Sourcing: buy the parts.",
      env: [],
      configured: true,
      built: "partial",
      note: "Builds search links per part and one add-to-cart link once ASINs are filled in. You complete checkout on Amazon; the app does not place orders.",
      source: null,
      admin: null,
    },
    {
      key: "amazon-sell",
      name: "Amazon Seller Central (SP-API)",
      purpose: "Sales → Sales monitor: orders and revenue.",
      env: ["AMAZON_SP_REFRESH_TOKEN", "AMAZON_SP_CLIENT_ID", "AMAZON_SP_CLIENT_SECRET"],
      configured: amazon.configured,
      built: "yes",
      note: "Reads orders (Orders API v2026-01-01) and daily totals (Sales API) on Sync now in Sales, Sales monitor. Read only; nothing about buyers is requested or stored. Needs a Professional selling account and a private SP-API app with the Inventory and Order Tracking role. Not yet run against the real service.",
      source: amazon.source,
      admin: "credentials",
    },
    {
      key: "x",
      name: "X",
      purpose: "Marketing → Posting, Replies and comments: send approved posts, read mentions.",
      env: ["X_ACCESS_TOKEN"],
      configured: x.configured,
      built: "yes",
      note: "Connect X account in Admin (OAuth 2.0 with PKCE). Marketing, Posting sends one approved post at a time after the cost statement is acknowledged; mentions are read into Replies and comments. Not yet run against the real service.",
      source: x.source,
      admin: "credentials",
    },
    {
      key: "instagram",
      name: "Instagram",
      purpose: "Marketing → Posting, Replies and comments: publish approved posts, read comments.",
      env: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"],
      configured: instagram.configured,
      built: "yes",
      note: "Marketing, Posting publishes one approved post at a time from a public JPEG address; comments are read into Replies and comments. The App Review checklist is in Admin, Credentials. Not yet run against the real service.",
      source: instagram.source,
      admin: "credentials",
    },
  ];
}
