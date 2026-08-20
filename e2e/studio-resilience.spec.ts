import { expect } from "@playwright/test";
import { test } from "./fixtures";
import {
  mockTurnstile,
  selectAgent,
  selectMantineOption,
  sendMessage,
  waitForHydration,
  waitForStreamComplete,
  getConversationEntries,
  openConfigPanel,
} from "./helpers";

function skipOnMobile(page: { viewportSize: () => { width: number } | null }) {
  const vs = page.viewportSize();
  if (vs && vs.width < 768) {
    test.skip(true, "Requires desktop viewport");
  }
}

test.describe("Playground — Resilience", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("surfaces a mid-stream error event as a failed run", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        JSON.stringify({ type: "token", data: "partial result" }) + "\n" +
        JSON.stringify({ type: "error", data: "Provider died mid-stream" }) + "\n";
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "stream then fail");

    await expect(page.locator("text=Error: Provider died mid-stream").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Stop streaming" })).toHaveCount(0);
    await expect(page.locator("text=failed after").first()).toBeVisible({ timeout: 5000 });
  });

  test("rounds a 429 rate-limit response into an error bubble", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Too many requests. Please slow down.", code: "RATE_LIMITED" }),
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "too fast");

    await expect(page.locator("text=Error: Too many requests. Please slow down.").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("renders tool calls with name and result once the tool loop resolves", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        JSON.stringify({
          type: "tool_call",
          id: "tool-1",
          name: "web_fetch",
          args: { url: "https://github.com/agenthood/agenthood" },
        }) + "\n" +
        JSON.stringify({
          type: "tool_result",
          id: "tool-1",
          name: "web_fetch",
          result: "fetched readme content",
        }) + "\n" +
        JSON.stringify({ type: "token", data: "Here is what I found." }) + "\n" +
        JSON.stringify({ type: "done" }) + "\n";
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "fetch the readme");
    await waitForStreamComplete(page);

    await expect(page.locator("text=web_fetch").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=fetched readme content").first()).toBeVisible();
    await expect(page.locator("text=Here is what I found.").first()).toBeVisible();
  });

  test("hides feedback buttons while streaming and shows them after completion", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      const body =
        JSON.stringify({ type: "token", data: "slow reply" }) + "\n" +
        JSON.stringify({ type: "done" }) + "\n";
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "wait for it");

    const helpfulBtn = page.getByRole("button", { name: "Helpful", exact: true });
    await expect(page.getByRole("button", { name: "Stop streaming" })).toBeVisible({
      timeout: 10000,
    });
    await expect(helpfulBtn).toHaveCount(0);
    await expect(page.locator("text=slow reply").first()).toBeVisible({ timeout: 15000 });
    await expect(helpfulBtn).toBeVisible({ timeout: 10000 });
  });

  test("recovers from corrupted conversation storage without crashing", async ({ page, mockChat }) => {
    await page.evaluate(() => {
      localStorage.setItem("agenthood-studio-conversations", "@@@ not json at all");
      localStorage.setItem("agenthood-studio-active-conversation", "{}");
    });
    await page.reload();
    await waitForHydration(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(0);

    await mockChat(["still works"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "hello after corruption");
    await waitForStreamComplete(page);
    await expect(page.locator("text=still works").first()).toBeVisible({ timeout: 10000 });
  });

  test("discards conversations older than 30 days on hydration", async ({ page }) => {
    const day = 24 * 60 * 60 * 1000;
    await page.evaluate((day) => {
      const now = Date.now();
      const conversations = [
        {
          id: "stale-1", agentId: "the-scribe", title: "Ancient chat",
          messages: [], config: {}, createdAt: now - 31 * day, tokenCount: 0,
        },
        {
          id: "fresh-1", agentId: "the-scribe", title: "Fresh chat",
          messages: [], config: {}, createdAt: now, tokenCount: 0,
        },
      ];
      localStorage.setItem("agenthood-studio-conversations", JSON.stringify(conversations));
      localStorage.setItem("agenthood-studio-active-conversation", "fresh-1");
    }, day);
    await page.reload();
    await waitForHydration(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toContain("Fresh chat");
  });

  test("shows Ollama connected when the tags endpoint responds", async ({ page }) => {
    skipOnMobile(page);
    // Playwright cannot intercept loopback fetches to :11434 (network-layer block),
    // so the probe targets a same-origin stand-in URL that passes the URL validator.
    await page.route(/\/api\/tags$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ models: [] }),
      });
    });
    await openConfigPanel(page);
    await selectMantineOption(page, "Provider", "Ollama (local)");
    const baseUrlInput = page.locator("input[placeholder*='localhost']");
    await expect(baseUrlInput).toBeVisible({ timeout: 10000 });
    await baseUrlInput.fill("http://localhost:3000");

    await expect(page.locator("text=Ollama connected at http://localhost:3000")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows Ollama not detected when the tags endpoint fails", async ({ page }) => {
    skipOnMobile(page);
    let tagsReached = false;
    await page.route(/\/api\/tags$/, async (route) => {
      tagsReached = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: "{}",
      });
    });
    await openConfigPanel(page);
    await selectMantineOption(page, "Provider", "Ollama (local)");
    const baseUrlInput = page.locator("input[placeholder*='localhost']");
    await expect(baseUrlInput).toBeVisible({ timeout: 10000 });
    await baseUrlInput.fill("http://localhost:3000");

    await expect(page.locator("text=Ollama not detected").first()).toBeVisible({ timeout: 10000 });
    expect(tagsReached).toBe(true);
  });

  test("flags an invalid external http Ollama URL", async ({ page }) => {
    skipOnMobile(page);
    await openConfigPanel(page);
    await selectMantineOption(page, "Provider", "Ollama (local)");

    const baseUrlInput = page.locator("input[placeholder*='localhost']");
    await expect(baseUrlInput).toBeVisible({ timeout: 10000 });
    await baseUrlInput.fill("http://evil.example:11434");

    await expect(page.locator("text=Invalid Ollama URL").first()).toBeVisible({ timeout: 10000 });
  });
});
