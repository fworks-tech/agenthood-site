import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, waitForStreamComplete, getConversationEntries, getMessages } from "./helpers";

test.describe("Playground — Conversation Management", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("multiple conversations listed after sending messages", async ({ page, mockChat }) => {
    await mockChat(["First response"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "first message");
    await waitForStreamComplete(page);

    await selectAgent(page, "the-architect");
    await sendMessage(page, "second message");
    await waitForStreamComplete(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(2);
  });

  test("switching conversation shows correct messages", async ({ page, mockChat }) => {
    await mockChat(["Response A"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "message A");
    await waitForStreamComplete(page);

    await selectAgent(page, "the-architect");
    await sendMessage(page, "message B");
    await waitForStreamComplete(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(2);

    const firstEntry = page.locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']").first();
    await firstEntry.click();
    await page.waitForTimeout(500);
    const messages = await getMessages(page);
    expect(messages.length).toBeGreaterThan(0);
  });

  test("delete conversation removes it from list", async ({ page, mockChat }) => {
    await mockChat(["test"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "hello");
    await waitForStreamComplete(page);

    let entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);

    const deleteBtn = page.locator("[data-conversation-list='sidebar'] button[title='Delete conversation']").first();
    await deleteBtn.click({ force: true });
    await page.waitForTimeout(500);

    entries = await getConversationEntries(page);
    expect(entries.length).toBe(0);
  });

  test("auto-title from first user message", async ({ page, mockChat }) => {
    await mockChat(["response"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "This is my first message to the agent");
    await waitForStreamComplete(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toContain("This is my first message");
  });

  test("new conversation button creates empty conversation", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await page.waitForTimeout(300);

    let entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);

    const newBtn = page.locator("[data-conversation-list='sidebar'] [title='New conversation']");
    await newBtn.click();
    await page.waitForTimeout(500);

    entries = await getConversationEntries(page);
    expect(entries.length).toBe(2);
  });

  test("conversations persist after page reload", async ({ page, mockChat }) => {
    await mockChat(["test"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "persist me");
    await waitForStreamComplete(page);
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Agents loaded").first()).toBeVisible({ timeout: 15000 });

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toContain("persist me");
  });
});
