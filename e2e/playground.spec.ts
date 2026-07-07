import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, getMessages, getTokenCounter, waitForStreamComplete, getConversationEntries, closeConfigPanel } from "./helpers";

test.describe("Playground — Core UI", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Hello", " world"]);
    await page.reload();
    await page.waitForLoadState("networkidle");
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

  test("code agent shows opencode affinity hint", async ({ page }) => {
    await selectAgent(page, "the-architect");
    await expect(page.locator("text=Code-optimized provider available")).toBeVisible();
    const switchBtn = page.locator("button:has-text('Switch to OpenCode')");
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();
    await page.waitForTimeout(200);
    await expect(page.getByLabel("Provider", { exact: true })).toHaveValue("OpenCode Zen");
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

    await expect(thumbsUp).toHaveClass(/text-emerald-400/);
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

    await expect(thumbsUp).not.toHaveClass(/text-emerald-400/);
  });
});
