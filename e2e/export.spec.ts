import { expect } from "@playwright/test";
import { test, buildChatSSEBody } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, waitForStreamComplete, waitForHydration } from "./helpers";
import { readFileSync } from "node:fs";

test.describe("Playground — Conversation Export", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.route("**/api/studio/chat/**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildChatSSEBody(["Hello ", "world"]),
      }),
    );
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  async function exportAs(page: import("@playwright/test").Page, label: string) {
    await page.getByRole("button", { name: "Export conversation" }).click();
    const menuItem = page.getByRole("menuitem", { name: label });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      menuItem.click(),
    ]);
    return download;
  }

  test("exports the conversation as JSON", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "export me please");
    await waitForStreamComplete(page);

    const download = await exportAs(page, "Export JSON");
    expect(download.suggestedFilename()).toMatch(/^agenthood-conversation-[a-z0-9-]+\.json$/);
    const path = await download.path();
    const data = JSON.parse(readFileSync(path!, "utf8"));
    expect(data.format).toBe("agenthood-conversation");
    const hasMessage = data.conversation.messages.some(
      (m: { role: string; content: string }) =>
        m.role === "user" && m.content.includes("export me please"),
    );
    expect(hasMessage).toBe(true);
  });

  test("exports the conversation as Markdown", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "export to markdown");
    await waitForStreamComplete(page);

    const download = await exportAs(page, "Export Markdown");
    expect(download.suggestedFilename()).toMatch(/^agenthood-conversation-[a-z0-9-]+\.md$/);
    const path = await download.path();
    const text = readFileSync(path!, "utf8");
    expect(text).toContain("## User");
    expect(text).toContain("export to markdown");
  });

  test("export menu is hidden until the conversation has messages", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await expect(page.getByRole("button", { name: "Export conversation" })).toBeHidden();
    await sendMessage(page, "now there is content");
    await waitForStreamComplete(page);
    await expect(page.getByRole("button", { name: "Export conversation" })).toBeVisible();
  });
});