import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, waitForStreamComplete, getConversationEntries, getMessages, waitForHydration } from "./helpers";

test.describe("Playground — Conversation Management", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("multiple conversations listed after sending messages", async ({ page, mockChat }) => {
    await mockChat(["First response"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "first message");
    await waitForStreamComplete(page, 1);

    await selectAgent(page, "the-architect");
    await sendMessage(page, "second message");
    await waitForStreamComplete(page, 2);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(2);
  });

  test("switching conversation renders that conversation's own messages", async ({ page, mockChat }) => {
    await mockChat(["Response A"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "message A");
    await waitForStreamComplete(page, 1);

    await selectAgent(page, "the-architect");
    await sendMessage(page, "message B");
    await waitForStreamComplete(page, 2);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(2);

    // the architect conversation is active; click the *scribe* one (a real
    // cross-agent switch, not the already-selected row the old test clicked)
    await page
      .locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']")
      .filter({ hasText: "message A" })
      .first()
      .click();
    await page.waitForTimeout(300);

    const texts = (await getMessages(page)).map((m) => m.text);
    expect(texts.some((t) => t.includes("message A"))).toBe(true);
    expect(texts.some((t) => t.includes("message B"))).toBe(false);
  });

  test("restored conversation renders after reload without re-selecting an agent", async ({ page, mockChat }) => {
    await mockChat(["Response A"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "persist me");
    await waitForStreamComplete(page);

    await selectAgent(page, "the-architect");
    await sendMessage(page, "architect chat");
    await waitForStreamComplete(page, 2);

    await page.reload();
    await waitForHydration(page);

    // active conversation is restored from localStorage, but no agent has been
    // clicked since reload — the view must still render it (regression: a null
    // selectedAgent used to fall through to the welcome screen)
    await expect(page.getByText("Welcome to Agenthood Studio")).toBeHidden();
    const texts = (await getMessages(page)).map((m) => m.text);
    expect(texts.some((t) => t.includes("architect chat"))).toBe(true);

    // and clicking the other, different-agent conversation must swap content
    await page
      .locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']")
      .filter({ hasText: "persist me" })
      .first()
      .click();
    await page.waitForTimeout(300);
    const after = (await getMessages(page)).map((m) => m.text);
    expect(after.some((t) => t.includes("persist me"))).toBe(true);
    expect(after.some((t) => t.includes("architect chat"))).toBe(false);
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
    await waitForHydration(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toContain("persist me");
  });
});
