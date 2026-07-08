import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, waitForStreamComplete } from "./helpers";

test.describe("Playground — Error & Log States", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("creates log entry on send and completion", async ({ page, mockChat }) => {
    await mockChat(["response"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "hello");
    await waitForStreamComplete(page);

    await expect(page.locator("text=completed in").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^→/).first()).toBeVisible();
  });

  test("creates error log entry on chat error", async ({ page, mockChatError }) => {
    await mockChatError("Something went wrong");
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "trigger error");
    await page.waitForTimeout(2000);

    const errorVisible = await page.locator("text=Something went wrong").isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test("stream abort creates cancelled log entry", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "token", data: "partial" }) + "\n"));
          await new Promise((r) => setTimeout(r, 5000));
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();
        },
      });
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const full = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
      let pos = 0;
      for (const c of chunks) { full.set(c, pos); pos += c.length; }
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: new TextDecoder().decode(full),
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "long message");
    await page.waitForTimeout(500);

    const stopBtn = page.locator("button[aria-label='Stop streaming']");
    await expect(stopBtn).toBeVisible({ timeout: 5000 });
    await stopBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=cancelled")).toBeVisible({ timeout: 5000 });
  });

  test("config save creates success log entry", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await page.locator("button:has-text('Save configuration')").click();
    await page.waitForTimeout(300);

    await expect(page.locator("text=Configuration saved locally")).toBeVisible({ timeout: 5000 });
  });
});
