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
  ]),
  {
    files: ["app/(main)/studio/playground/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/studio/_lib/*", "**/_lib/*"],
              allowTypeImports: true,
              message:
                "Presentation layer must not import from _lib — use hooks instead (see ADR-008).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["__tests__/**/*.{ts,tsx,mjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["app/(main)/studio/_components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../_lib/log-store",
              message:
                "Components must not import log-store — use useLogs instead (see ADR-008).",
            },
            {
              name: "../_lib/stream",
              message:
                "Components must not import stream — use useStudioChat instead (see ADR-008).",
            },
            {
              name: "../_lib/export-conversation",
              message:
                "Components must not import export-conversation — use useConversationExport instead (see ADR-008).",
            },
          ],
          patterns: [
            {
              group: ["**/studio/_lib/log-store", "**/studio/_lib/stream", "**/studio/_lib/export-conversation"],
              message:
                "Components must not import infra _lib — use hooks instead (see ADR-008).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
