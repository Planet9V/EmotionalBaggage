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
      purpose: "Concept → Challenge today; drafts and reviews across the pipeline later.",
      env: [],
      configured: reasoning.configured,
      built: "partial",
      note: `${reasoning.note} The reviewer in Concept → Challenge uses it; the other drafting features are not built. Not yet run against a real Ollama, LM Studio or OpenRouter.`,
      source: reasoning.source,
      admin: "settings",
    },
    {
      key: "embedding-model",
      name: "Embedding model",
      purpose: "Search by meaning across rows and research.",
      env: [],
      configured: embedding.configured,
      built: "partial",
      note: `${embedding.note} Rows are embedded by POST /api/index and searched with mode=meaning; research answers are not embedded yet, and there is no button for either. Needs pgvector in the database. Not yet run against a real model host.`,
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
      purpose: "Prototype → 3D printing: live status and job progress.",
      env: ["PRINTER_KIND", "PRINTER_URL"],
      configured: printers.configured,
      built: "partial",
      note: `${printers.note} Status reads for OctoPrint and Moonraker (Klipper) over HTTP. Other families can be saved but not driven yet. Sending files to print is not built yet. Not yet run against a real printer.`,
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
      built: "no",
      note: "Needs a seller account and an SP-API app. The call code is not built yet.",
      source: amazon.source,
      admin: "credentials",
    },
    {
      key: "x",
      name: "X",
      purpose: "Marketing → Social: post and read replies.",
      env: ["X_ACCESS_TOKEN"],
      configured: x.configured,
      built: "no",
      note: "Drafts and approvals work in the app. Posting and reply reading are not built yet.",
      source: x.source,
      admin: "credentials",
    },
    {
      key: "instagram",
      name: "Instagram",
      purpose: "Marketing → Social: post and read comments.",
      env: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"],
      configured: instagram.configured,
      built: "no",
      note: "Drafts and approvals work in the app. Posting and comment reading are not built yet.",
      source: instagram.source,
      admin: "credentials",
    },
  ];
}
