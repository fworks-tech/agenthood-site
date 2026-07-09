import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
   webServer: {
     command: "npm run dev",
     url: "http://localhost:3000/studio/playground/",
     reuseExistingServer: true,
     timeout: 120000,
     env: {
       NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
       TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
     },
   },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
