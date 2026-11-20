// One place that says what is connected. Nothing here pretends:
// an integration is "connected" only when its credentials are present,
// and "built" only when this prototype actually calls the service.

export type Integration = {
  key: string;
  name: string;
  purpose: string;
  env: string[];
  configured: boolean;
  /** does this prototype contain working call code for it? */
  built: "yes" | "partial" | "no";
  note: string;
};

const has = (...names: string[]) => names.every((n) => !!process.env[n]);

export function listIntegrations(): Integration[] {
  return [
    {
      key: "ai",
      name: "AI reviewer",
      purpose: "Concept → Challenge: pushes back on the proposition.",
      env: ["ANTHROPIC_API_KEY"],
      configured: has("ANTHROPIC_API_KEY"),
      built: "yes",
      note: "Calls the Anthropic Messages API. Model set by ANTHROPIC_MODEL. Not yet run against a live key.",
    },
    {
      key: "perplexity",
      name: "Perplexity",
      purpose: "Research → Ask: web research with citations.",
      env: ["PERPLEXITY_API_KEY"],
      configured: has("PERPLEXITY_API_KEY"),
      built: "yes",
      note: "Calls POST https://api.perplexity.ai/v1/sonar. Model set by PERPLEXITY_MODEL. Not yet run against a live key.",
    },
    {
      key: "printer",
      name: "3D printer",
      purpose: "Prototype → 3D printing: live status and job progress.",
      env: ["PRINTER_KIND", "PRINTER_URL"],
      configured: has("PRINTER_KIND", "PRINTER_URL"),
      built: "partial",
      note: "Status reads for OctoPrint and Moonraker (Klipper) over HTTP. Bambu Lab printers use MQTT and are not built yet. Sending files to print is not built yet. Not yet run against a real printer.",
    },
    {
      key: "amazon-buy",
      name: "Amazon purchasing",
      purpose: "Prototype → Sourcing: buy the parts.",
      env: [],
      configured: true,
      built: "partial",
      note: "Builds search links per part and one add-to-cart link once ASINs are filled in. You complete checkout on Amazon; the app does not place orders.",
    },
    {
      key: "amazon-sell",
      name: "Amazon Seller Central (SP-API)",
      purpose: "Sales → Sales monitor: orders and revenue.",
      env: ["AMAZON_SP_REFRESH_TOKEN", "AMAZON_SP_CLIENT_ID", "AMAZON_SP_CLIENT_SECRET"],
      configured: has("AMAZON_SP_REFRESH_TOKEN", "AMAZON_SP_CLIENT_ID", "AMAZON_SP_CLIENT_SECRET"),
      built: "no",
      note: "Needs a seller account and an SP-API app. The call code is not built yet.",
    },
    {
      key: "x",
      name: "X",
      purpose: "Marketing → Social: post and read replies.",
      env: ["X_ACCESS_TOKEN"],
      configured: has("X_ACCESS_TOKEN"),
      built: "no",
      note: "Drafts and approvals work in the app. Posting and reply reading are not built yet.",
    },
    {
      key: "instagram",
      name: "Instagram",
      purpose: "Marketing → Social: post and read comments.",
      env: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"],
      configured: has("INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"),
      built: "no",
      note: "Drafts and approvals work in the app. Posting and comment reading are not built yet.",
    },
  ];
}
