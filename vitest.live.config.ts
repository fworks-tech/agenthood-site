// Opt-in live suite. Separate from vitest.config.ts because vitest's CLI
// --exclude flag merges with the config's exclude list instead of replacing it,
// so a directory excluded from `npm test` cannot be re-included on the command
// line. That is why this is a config file and not a flag.
//
// Reach it through `npm run test:live`, which needs a funded OPENCODE_API_KEY.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/live/**/*.test.ts"],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
