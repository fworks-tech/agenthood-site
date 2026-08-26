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
  readTurnstileResetCount,
  resetTurnstileCounter,
  expireAndReissue,
  setTurnstileAutoRenew,
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
    // The mock seeds __turnstileResetCount on injection; zero it explicitly so
    // the toBe(0)/toBeGreaterThan(0) assertions never inherit a prior count.
    await resetTurnstileCounter(page);
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

    // The CAPTCHA_FAILED response means the previous token was consumed by the
    // server, so the auto-retry must reset the widget to obtain a fresh token
    // rather than silently reusing the spent one.
    const resets = await readTurnstileResetCount(page);
    expect(resets).toBeGreaterThan(0);
  });

  test("keeps the verified token usable when the widget expires and re-verifies", async ({ page }) => {
    await mockChat(page);

    await selectAgent(page, "the-scribe");
    await closeConfigPanel(page);

    // The first token is issued on render (autoVerify). Simulate expiry plus the
    // widget's background re-verification issuing a fresh token.
    await expireAndReissue(page);

    // Expiry must not invalidate the verified token: the widget is not
    // reset/unchecked, and sending a message still works.
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("first message");
    await expect(page.locator("button[aria-label='Send message']")).toBeEnabled();
    expect(await readTurnstileResetCount(page)).toBe(0);

    await sendMessage(page, "first message");
    await waitForStreamComplete(page);
    const messages1 = await getMessages(page);
    expect(messages1.some((m) => m.role === "user" && m.text.includes("first message"))).toBeTruthy();
  });

  test("expiry makes the captcha widget visible during re-verification", async ({ page }) => {
    await mockChat(page);

    await selectAgent(page, "the-scribe");
    await closeConfigPanel(page);

    await sendMessage(page, "first message");
    await waitForStreamComplete(page);

    // Widget is hidden after successful message (captchaVerified=true):
    // the mock gives the widget a fixed-size child, so assert the hidden style
    // rather than visibility (opacity:0 still has a bounding box).
    const widget = page.locator(".turnstile-widget");
    await expect(widget).toHaveAttribute("style", /opacity: 0/);

    // Simulate token expiry: expired-callback sets captchaVerified=false,
    // then the mock re-issues a token after 50ms which sets it back to true.
    await expireAndReissue(page);

    // After re-verification completes, the widget must be hidden again.
    await expect.poll(async () => {
      const style = await widget.getAttribute("style");
      return style ?? "";
    }, { timeout: 5000 }).toContain("opacity: 0");

    // Sending still works after re-verification.
    await sendMessage(page, "second message");
    await waitForStreamComplete(page);
    const messages = await getMessages(page);
    expect(messages.some((m) => m.role === "user" && m.text.includes("second message"))).toBeTruthy();
  });

  test("CAPTCHA_FAILED refresh timeout shows the widget and error", async ({ page }) => {
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

    // Prevent the mock from issuing a new token on reset, simulating an
    // invisible widget that cannot complete the Cloudflare challenge.
    await setTurnstileAutoRenew(page, true);

    // Second message triggers CAPTCHA_FAILED; refreshCaptchaAndWait will
    // timeout because the mock no longer issues tokens on reset.
    await sendMessage(page, "second message");

    // The widget becomes visible so the user can re-verify.
    const widget = page.locator(".turnstile-widget");
    await expect(widget).toBeVisible({ timeout: 15000 });

    // Error message appears in the composer.
    await expect(
      page.locator("span.text-red-400").filter({ hasText: "CAPTCHA refresh timed out" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("Retry CAPTCHA button re-renders the widget after refresh failure", async ({ page }) => {
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

    // Prevent the mock from issuing a new token on reset (simulates invisible widget).
    await setTurnstileAutoRenew(page, true);

    await sendMessage(page, "second message");
    await expect(
      page.locator("span.text-red-400").filter({ hasText: "CAPTCHA refresh timed out" }),
    ).toBeVisible({ timeout: 15000 });

    // Re-enable token issuance so the retry can succeed.
    await setTurnstileAutoRenew(page, false);

    // Click Retry CAPTCHA — this resets the widget and nulls the token.
    await page.getByRole("button", { name: "Retry CAPTCHA" }).click();

    // Type a message and wait for the reset widget to deliver a fresh token,
    // then the send button re-enables.
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("third message");
    const sendBtn = page.locator("button[aria-label='Send message']");
    await expect(sendBtn).toBeEnabled({ timeout: 10000 });
  });
});
