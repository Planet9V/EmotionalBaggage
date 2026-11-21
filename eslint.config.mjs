import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "vendor/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Library code copied in by the shadcn CLI and kept as its makers wrote it, so updates stay a re-run.
    "src/components/ai-elements/**",
    "src/components/ui/carousel.tsx",
  ]),
]);

export default eslintConfig;
