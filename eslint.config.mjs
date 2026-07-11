import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".vercel/**",
    ".returnpick/**",
    "node_modules/**",
    "tsconfig.tsbuildinfo",
    "*.log",
    "dev-server-*.log",
    "dev-server-*.err.log"
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn"
    }
  }
]);
