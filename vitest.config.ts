import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // __tests__/live hits the real provider and costs money — `npm run test:live` only.
    exclude: ["e2e/**", "node_modules/**", "dist/**", "__tests__/live/**"],
    testTimeout: 10000,
    // Warms the route module graphs once per run; see __tests__/global-setup.ts.
    globalSetup: ["__tests__/global-setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "app/middleware.ts",
        "app/api/studio/*/route.ts",
        "app/(main)/studio/_data/agents.ts",
        "app/(main)/studio/_lib/*.ts",
        "app/(main)/studio/_types/*.ts",
      ],
      exclude: [
        "app/(main)/studio/_lib/workspace-synthesizer.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 85,
        lines: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});