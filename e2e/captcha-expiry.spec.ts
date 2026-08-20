import { expect } from "@playwright/test";
import { test } from "./fixtures";
import {
  mockTurnstile,
  selectAgent,
  sendMessage,
  getMessages,
  waitForStreamComplete,
  waitForHydration,
  closeConfigPanel,
} from "./helpers";

test.describe("Playground — CAPTCHA Expiry Auto-Retry", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("auto-retries when CAPTCHA token expires mid-conversation", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/studio/chat/**", async (route) => {
      const reqBody = route.request().postDataJSON();
      if (!reqBody?.agentId || !reqBody?.messages) {
        await route.fulfill({ status: 400, body: JSON.stringify({ error: "Invalid request" }) });
        return;
      }
      requestCount++;
      if (requestCount === 2) {
        await route.fulfill({
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "CAPTCHA verification failed. Please refresh and try again.", code: "CAPTCHA_FAILED" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: [
          JSON.stringify({ type: "token", data: "Hello" }) + "\n",
          JSON.stringify({ type: "token", data: " world" }) + "\n",
          JSON.stringify({ type: "done" }) + "\n",
        ].join(""),
      });
    });

    await selectAgent(page, "the-scribe");
    await closeConfigPanel(page);

    await sendMessage(page, "first message");
    await waitForStreamComplete(page);
    const messages1 = await getMessages(page);
    expect(messages1.some((m) => m.role === "user" && m.text.includes("first message"))).toBeTruthy();

    await sendMessage(page, "second message");

    await expect
      .poll(async () => await page.locator("text=completed in").count(), { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);

    const messages2 = await getMessages(page);
    const userMsgs = messages2.filter((m) => m.role === "user");
    expect(userMsgs.filter((m) => m.text.includes("second message"))).toHaveLength(1);

    expect(requestCount).toBe(3);
  });
});
