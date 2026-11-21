// First-run status (plan item 0.4): what is and is not configured yet, each with what it enables.
import { q, ready } from "@/lib/db";
import { credentialSource, embeddingModel, reasoningModel, type ModelChoice } from "@/lib/settings";
import { plannerHealth } from "./planner";

export type StatusItem = {
  key: "reasoningModel" | "embeddingModel" | "research" | "printer" | "planner" | "vectorStore";
  label: string;
  configured: boolean;
  /** what it enables, in one line */
  explanation: string;
  /** the current state, in one line */
  state: string;
  /** the part of Admin where it is set */
  section: "settings" | "credentials" | "printers";
};

async function modelState(choice: ModelChoice | null): Promise<[boolean, string]> {
  if (!choice) return [false, "Not chosen yet."];
  if (choice.provider === "openrouter" && (await credentialSource("openrouter", "apiKey")) === null) {
    return [false, `${choice.model} on OpenRouter is chosen, but no OpenRouter key is saved.`];
  }
  return [true, `${choice.model} on ${choice.provider}.`];
}

export async function firstRunStatus(): Promise<{ complete: boolean; items: StatusItem[] }> {
  const [reasoning, embedding, research, printers, planner, db] = await Promise.all([
    reasoningModel().then(modelState),
    embeddingModel().then(modelState),
    credentialSource("perplexity", "apiKey"),
    q<{ n: number }>("SELECT count(*)::int AS n FROM printers WHERE enabled"),
    plannerHealth(),
    ready(),
  ]);
  const printerCount = printers[0].n;
  const envPrinter = !!(process.env.PRINTER_KIND && process.env.PRINTER_URL);
  const items: StatusItem[] = [
    {
      key: "reasoningModel",
      label: "Reasoning model",
      configured: reasoning[0],
      explanation: "Lets the assistant draft and review your concept, from the brief through to tests and marketing.",
      state: reasoning[1],
      section: "settings",
    },
    {
      key: "embeddingModel",
      label: "Embedding model",
      configured: embedding[0],
      explanation: "Lets search find rows and research by meaning, not only by matching words.",
      state: embedding[1],
      section: "settings",
    },
    {
      key: "research",
      label: "Research key (Perplexity)",
      configured: research !== null,
      explanation: "Lets Research answer questions from the web with citations you can check.",
      state: research === "admin" ? "A key is saved." : research === "environment" ? "A key comes from the environment." : "No key yet.",
      section: "credentials",
    },
    {
      key: "printer",
      label: "Printer",
      configured: printerCount > 0 || envPrinter,
      explanation: "Lets the app show print progress. Without one you can still download files and print by hand.",
      state:
        printerCount > 0
          ? `${printerCount} printer${printerCount === 1 ? "" : "s"} switched on.`
          : envPrinter
            ? "None in Admin; one is set in the environment."
            : "None added yet.",
      section: "printers",
    },
    {
      key: "planner",
      label: "Planner",
      configured: planner.connected,
      explanation: "Works out the order of operations and the critical path for each concept.",
      state: planner.connected ? `Reachable (NetworkX ${planner.networkx ?? "unknown"}).` : `Not reachable: ${planner.error ?? "no answer"}.`,
      section: "settings",
    },
  ];
  // Shown only when it went wrong: pgvector is installed but the embeddings table could not be made at start-up.
  if (db.vectorProblem) {
    items.push({
      key: "vectorStore",
      label: "Search by meaning",
      configured: false,
      explanation: "Stores the vectors that let search find rows by meaning. Until it is fixed, search matches words only. Check the server log, then restart the app.",
      state: db.vectorProblem,
      section: "settings",
    });
  }
  return { complete: items.every((i) => i.configured), items };
}
