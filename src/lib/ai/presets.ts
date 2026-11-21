// Starting points offered in Admin, Models. Choosing one fills the form; every field stays editable, and
// nothing here is used until it is saved there. Each entry says where its facts were read.
import type { ModelChoice } from "@/lib/settings";

export type EmbeddingPreset = {
  id: string;
  label: string;
  choice: Required<Pick<ModelChoice, "provider" | "baseUrl" | "model">> & { dims: number };
  note: string;
};

// Qwen3 Embedding 8B gives 4,096 numbers per text.
// - Ollama: tag `qwen3-embedding:8b`; its model file states embedding_length 4096 and context 40,960
//   (ollama.com/library/qwen3-embedding:8b, read 20 November 2026).
// - OpenRouter: `qwen/qwen3-embedding-8b` (openrouter.ai/qwen/qwen3-embedding-8b, read 20 November 2026).
// - LM Studio shows the name of whichever file you downloaded, so its model name is left for you to fill in.
// pgvector's HNSW index covers plain vectors up to 2,000 numbers and half-precision ones up to 4,000, so at
// 4,096 the app indexes a one-bit-per-number copy and re-ranks the candidates by the full vectors
// (pgvector README, "Binary Quantization"); see src/lib/ai/embeddings.ts.
export const EMBEDDING_PRESETS: EmbeddingPreset[] = [
  {
    id: "qwen3-8b-ollama",
    label: "Qwen3 Embedding 8B on Ollama (4,096)",
    choice: { provider: "ollama", baseUrl: "http://host.docker.internal:11434/v1", model: "qwen3-embedding:8b", dims: 4096 },
    note: "Run `ollama pull qwen3-embedding:8b` first. About 4.7 GB at the default quantisation.",
  },
  {
    id: "qwen3-8b-openrouter",
    label: "Qwen3 Embedding 8B on OpenRouter (4,096)",
    choice: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "qwen/qwen3-embedding-8b", dims: 4096 },
    note: "Needs an OpenRouter key in Credentials. Billed per token by OpenRouter.",
  },
  {
    id: "qwen3-8b-lmstudio",
    label: "Qwen3 Embedding 8B on LM Studio (4,096)",
    choice: { provider: "lmstudio", baseUrl: "http://host.docker.internal:1234/v1", model: "", dims: 4096 },
    note: "Download a Qwen3-Embedding-8B GGUF in LM Studio, load it, and copy its model name here.",
  },
];
