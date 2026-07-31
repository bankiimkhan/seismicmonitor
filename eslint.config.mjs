import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored maplibre-gl worker bundle, copied verbatim by
    // scripts/copy-maplibre-worker.mjs -- not our code to lint.
    "public/maplibre-gl-worker.mjs",
    "public/maplibre-gl-shared.mjs",
    // Cloudflare build output and generated binding types (`npm run cf-typegen`).
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
    // Deno, and generated from lib/ by scripts/sync-edge-shared.mjs.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
