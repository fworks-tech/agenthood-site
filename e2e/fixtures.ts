import { test as base, type Page } from "@playwright/test";

export function buildChatSSEBody(tokens: string[]): string {
  return (
    tokens.map((t) => JSON.stringify({ type: "token", data: t }) + "\n").join("") +
    JSON.stringify({ type: "done" }) + "\n"
  );
}

export function buildChatErrorBody(msg: string): string {
  return JSON.stringify({ type: "error", data: msg }) + "\n";
}

export const test = base.extend<{
  mockChat: (tokens?: string[]) => Promise<void>;
  mockChatError: (msg?: string) => Promise<void>;
  clearStorage: () => Promise<void>;
}>({
  mockChat: async ({ page }, use) => {
    await use(async (tokens = ["Hello", " world"]) => {
      const body = buildChatSSEBody(tokens);
      await page.route("**/api/studio/chat/**", async (route) => {
        const reqBody = route.request().postDataJSON();
        if (!reqBody?.agentId || !reqBody?.messages) {
          await route.fulfill({ status: 400, body: JSON.stringify({ error: "Invalid request" }) });
          return;
        }
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body,
        });
      });
    });
  },
  mockChatError: async ({ page }, use) => {
    await use(async (msg = "Provider unavailable") => {
      const body = buildChatErrorBody(msg);
      await page.route("**/api/studio/chat/**", async (route) => {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body,
        });
      });
    });
  },
  clearStorage: async ({ page }, use) => {
    await use(async () => {
      await page.evaluate(() => localStorage.clear());
    });
  },
});
