import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, getMessages, getTokenCounter, waitForStreamComplete, getConversationEntries, closeConfigPanel, openConfigPanel, waitForHydration } from "./helpers";

test.describe("Playground — Core UI", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Hello", " world"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("loads with config panel open on desktop", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) {
      const openBtn = page.getByRole("button", { name: "Open config panel" });
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator("text=Agent Configuration")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Welcome to Agenthood Studio")).toBeVisible();
  });

  test("shows welcome empty state when no agent selected", async ({ page }) => {
    await expect(page.locator("text=Welcome to Agenthood Studio")).toBeVisible();
    await expect(page.locator("text=Select a Society member from the left panel")).toBeVisible();
    const composer = page.locator("textarea[placeholder='Type a message...']");
    await expect(composer).not.toBeVisible();
  });

  test("selecting agent creates conversation and shows composer", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) {
      await closeConfigPanel(page);
    }
    await expect(page.locator("textarea[placeholder='Type a message...']")).toBeVisible();
    const entries = await getConversationEntries(page);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].title).toBe("New conversation");
  });

  test("sending message renders user and assistant bubbles", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Write a commit message");
    await waitForStreamComplete(page);
    const messages = await getMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const userMsg = messages.find((m) => m.role === "user");
    const assistantMsg = messages.find((m) => m.role === "assistant");
    expect(userMsg?.text).toContain("Write a commit message");
    expect(assistantMsg?.text).toContain("Hello world");
  });

  test("token counter appears after streaming", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "test");
    await waitForStreamComplete(page);
    const counter = await getTokenCounter(page);
    expect(counter).not.toBeNull();
    if (counter) {
      await expect(counter).toBeVisible();
    }
  });

  test("clear button resets messages and token counter", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "test");
    await waitForStreamComplete(page);
    const clearBtn = page.locator("button:has-text('Clear')").first();
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForTimeout(500);
    const messages = await getMessages(page);
    expect(messages.length).toBe(0);
    const counter = await getTokenCounter(page);
    expect(counter).toBeNull();
  });

  test("runs on the pinned demo model with no setup", async ({ page }) => {
    await selectAgent(page, "the-architect");
    await expect(page.locator("text=· opencode · gpt-5-nano").first()).toBeVisible();
  });

  test("no provider, model, or API key controls remain in the panel", async ({ page }) => {
    await selectAgent(page, "the-architect");
    await openConfigPanel(page);
    await expect(page.locator("text=Model & Behavior")).toHaveCount(0);
    await expect(page.getByLabel("Provider", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Model", { exact: true })).toHaveCount(0);
    await expect(page.locator("input[type=password]")).toHaveCount(0);
  });

  test("Web Fetch is on by default in the outgoing request", async ({ page }) => {
    const bodies: Array<{ config?: { enabledTools?: string[] } }> = [];
    await page.route("**/api/studio/chat/**", async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: JSON.stringify({ type: "done" }) + "\n",
      });
    });

    await selectAgent(page, "the-architect");
    await sendMessage(page, "review https://github.com/fworks-tech/agenthood");
    await waitForStreamComplete(page);

    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0].config?.enabledTools).toEqual(["web_fetch"]);
  });

  test("thumbs up sends feedback to server", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Great response");
    await waitForStreamComplete(page);

    const feedbackPromise = page.waitForResponse((res) =>
      res.url().includes("/api/studio/feedback") && res.request().method() === "POST",
    );

    const thumbsUp = page.locator("button[title='Helpful']").first();
    await expect(thumbsUp).toBeVisible();
    await thumbsUp.click();

    const feedbackRes = await feedbackPromise;
    expect(feedbackRes.status()).toBe(200);
  });

  test("toggling thumbs up off sends null feedback", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Test message");
    await waitForStreamComplete(page);

    const thumbsUp = page.locator("button[title='Helpful']").first();
    await thumbsUp.click();
    await page.waitForTimeout(200);

    const nullPromise = page.waitForResponse((res) =>
      res.url().includes("/api/studio/feedback") && res.request().method() === "POST",
    );

    await thumbsUp.click();
    const nullRes = await nullPromise;
    expect(nullRes.status()).toBe(200);
  });
});
