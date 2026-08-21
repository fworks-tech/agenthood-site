import { expect } from "@playwright/test";
import { test, buildChatSSEBody } from "./fixtures";
import {
  mockTurnstile,
  selectAgent,
  sendMessage,
  getMessages,
  getConversationEntries,
  waitForAssistantCount,
  openConversationSidebar,
  waitForHydration,
} from "./helpers";

test.describe("Playground — Chat History & Multi-Turn Context", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("second message renders four bubbles and updates sidebar count and title", async ({
    page,
    mockChatSequence,
  }) => {
    await mockChatSequence([["First answer"], ["Second answer"]]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "first question");
    await waitForAssistantCount(page, 1);
    await sendMessage(page, "second question");
    await waitForAssistantCount(page, 2);

    const messages = await getMessages(page);
    expect(messages.filter((m) => m.role === "user").length).toBe(2);
    expect(messages.filter((m) => m.role === "assistant").length).toBe(2);
    expect(messages.find((m) => m.role === "user")?.text).toContain("first question");
    expect(messages.find((m) => m.role === "user" && m.text.includes("second question"))).toBeTruthy();
    expect(messages.find((m) => m.role === "assistant" && m.text.includes("First answer"))).toBeTruthy();
    expect(messages.find((m) => m.role === "assistant" && m.text.includes("Second answer"))).toBeTruthy();

    await openConversationSidebar(page);
    const firstEntry = page.locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']").first();
    await expect(firstEntry).toContainText("first question");
    await expect(firstEntry).toContainText("4 msgs");
  });

  test("second message sends full conversation history as context", async ({ page }) => {
    const requestBodies: Array<{ messages: { role: string; content: string }[] }> = [];
    await page.route("**/api/studio/chat/**", async (route) => {
      const reqBody = route.request().postDataJSON();
      requestBodies.push(reqBody);
      const messageCount = reqBody?.messages?.length ?? 0;
      const body = buildChatSSEBody([`reply-${messageCount}`]);
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "first question");
    await waitForAssistantCount(page, 1);
    await sendMessage(page, "second question");
    await waitForAssistantCount(page, 2);

    expect(requestBodies.length).toBe(2);
    const first = requestBodies[0].messages;
    expect(first.map((m) => m.role)).toEqual(["user"]);
    expect(first[0].content).toBe("first question");

    const second = requestBodies[1].messages;
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[0].content).toBe("first question");
    expect(second[1].content).toContain("reply-1");
    expect(second[2].content).toBe("second question");

    const messages = await getMessages(page);
    const assistantReplies = messages.filter((m) => m.role === "assistant");
    expect(assistantReplies[1].text).toContain("reply-3");
  });

  test("each message carries a fresh single-use turnstile token", async ({ page }) => {
    const tokens: Array<string | undefined> = [];
    await page.route("**/api/studio/chat/**", async (route) => {
      const reqBody = route.request().postDataJSON();
      tokens.push(reqBody?.turnstileToken);
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildChatSSEBody(["ok"]),
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "one");
    await waitForAssistantCount(page, 1);
    await page.waitForTimeout(300);
    await sendMessage(page, "two");
    await waitForAssistantCount(page, 2);

    expect(tokens.length).toBe(2);
    expect(tokens[0]).toBeTruthy();
    expect(tokens[1]).toBeTruthy();
    // The server consumes each token on verification, so a fresh token must be
    // issued for every message instead of reusing the previous one.
    expect(tokens[1]).not.toBe(tokens[0]);
  });

  test("switching conversations restores messages and saved config", async ({ page, mockChatSequence }) => {
    await mockChatSequence([["scribe reply"], ["steward reply"]]);

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "design a commit");
    await waitForAssistantCount(page, 1);

    await selectAgent(page, "the-steward");
    await sendMessage(page, "route my task");
    await waitForAssistantCount(page, 1);

    await expect(page.locator("text=· opencode-go ·").first()).toBeVisible();

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(2);

    const scribeEntry = page
      .locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']")
      .filter({ hasText: "design a commit" });
    await scribeEntry.click();
    await page.waitForTimeout(500);

    const messages = await getMessages(page);
    expect(messages.some((m) => m.role === "user" && m.text.includes("design a commit"))).toBeTruthy();
    expect(messages.some((m) => m.role === "user" && m.text.includes("route my task"))).toBeFalsy();
    expect(messages.some((m) => m.role === "assistant" && m.text.includes("scribe reply"))).toBeTruthy();

    await expect(page.locator("text=· opencode-go ·").first()).toBeVisible();
  });

  test("full history survives page reload and chat continues with context", async ({ page }) => {
    const requestBodies: Array<{ messages: { role: string; content: string }[] }> = [];
    await page.route("**/api/studio/chat/**", async (route) => {
      const reqBody = route.request().postDataJSON();
      requestBodies.push(reqBody);
      const messageCount = reqBody?.messages?.length ?? 0;
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildChatSSEBody([`reply-${messageCount}`]),
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "persist one");
    await waitForAssistantCount(page, 1);
    await sendMessage(page, "persist two");
    await waitForAssistantCount(page, 2);

    await page.reload();
    await waitForHydration(page);

    const entries = await getConversationEntries(page);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toContain("persist one");

    await selectAgent(page, "the-scribe");
    await openConversationSidebar(page);
    const persisted = page
      .locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']")
      .filter({ hasText: "persist one" });
    await persisted.click();
    await page.waitForTimeout(500);

    const restored = await getMessages(page);
    expect(restored.filter((m) => m.role === "user").length).toBe(2);
    expect(restored.filter((m) => m.role === "assistant").length).toBe(2);
    expect(restored.find((m) => m.role === "assistant" && m.text.includes("reply-1"))).toBeTruthy();
    expect(restored.find((m) => m.role === "assistant" && m.text.includes("reply-3"))).toBeTruthy();

    await sendMessage(page, "third message");
    await waitForAssistantCount(page, 3);

    const third = requestBodies[2].messages;
    expect(third.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(third[1].content).toContain("reply-1");
    expect(third[3].content).toContain("reply-3");
    expect(third[4].content).toBe("third message");
  });

  test("server error status (401) renders error bubble and failure log", async ({ page }) => {
    await page.route("**/api/studio/chat/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      }),
    );

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "boom");
    await expect(page.locator("text=Error: Unauthorized").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=failed after").first()).toBeVisible();
  });

  test("validation error (400) renders error bubble and failure log", async ({ page }) => {
    await page.route("**/api/studio/chat/**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Validation error: bad request", code: "VALIDATION_ERROR" }),
      }),
    );

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "invalid");
    await expect(page.locator("text=Error: Validation error: bad request").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=failed after").first()).toBeVisible();
  });
});
