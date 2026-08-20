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
  async function mockChat(page: import("@playwright/test").Page, failRequest = 0) {
    let requestCount = 0;
    await page.route("**/api/studio/chat/**", async (route) => {
      const reqBody = route.request().postDataJSON();
      if (!reqBody?.agentId || !reqBody?.messages) {
        await route.fulfill({ status: 400, body: JSON.stringify({ error: "Invalid request" }) });
        return;
      }
      requestCount++;
      if (failRequest > 0 && requestCount === failRequest) {
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
    return () => requestCount;
  }

  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("auto-retries when CAPTCHA token expires mid-conversation", async ({ page }) => {
    const requestCount = await mockChat(page, 2);

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

    expect(requestCount()).toBe(3);

    // The verified token was never invalidated: the widget was not reset during
    // the auto-retry (the checkbox stays checked for the whole conversation).
    expect(await page.evaluate(() => (window as unknown as { __turnstileResetCount?: number }).__turnstileResetCount ?? 0)).toBe(0);
  });

  test("keeps the verified token usable when the widget expires and re-verifies", async ({ page }) => {
    await mockChat(page);

    await selectAgent(page, "the-scribe");
    await closeConfigPanel(page);

    // The first token is issued on render (autoVerify). Simulate expiry plus the
    // widget's background re-verification issuing a fresh token.
    await page.evaluate(() => {
      (window as unknown as { turnstile?: { expireAndReissue?: () => void } }).turnstile?.expireAndReissue?.();
    });

    // Expiry must not invalidate the verified token: the widget is not
    // reset/unchecked, and sending a message still works.
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("first message");
    await expect(page.locator("button[aria-label='Send message']")).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as { __turnstileResetCount?: number }).__turnstileResetCount ?? 0)).toBe(0);

    await sendMessage(page, "first message");
    await waitForStreamComplete(page);
    const messages1 = await getMessages(page);
    expect(messages1.some((m) => m.role === "user" && m.text.includes("first message"))).toBeTruthy();
  });
});
