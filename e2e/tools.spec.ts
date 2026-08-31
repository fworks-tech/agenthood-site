import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, sendMessage, waitForHydration } from "./helpers";

const FAILING_TOOL_SSE = [
  JSON.stringify({ type: "tool_call", id: "tc-1", name: "code_execution", args: { code: "fail()" } }) + "\n",
  JSON.stringify({ type: "tool_result", id: "tc-1", name: "code_execution", result: "Error: boom", error: "Error: boom" }) + "\n",
  JSON.stringify({ type: "token", data: "Tool run finished" }) + "\n",
  JSON.stringify({ type: "done" }) + "\n",
].join("");

test.describe("Playground — Tool Execution History & Replay", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.route("**/api/studio/chat/**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: FAILING_TOOL_SSE,
      }),
    );
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("renders a failing tool call with expandable details", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "run the failing tool");

    const toolRow = page.locator("button[aria-expanded]").filter({ hasText: "code_execution" });
    await expect(toolRow).toBeVisible({ timeout: 10000 });
    await expect(toolRow).toContainText("boom");

    // Collapsed by default; expand reveals args, error, and the retry action.
    await toolRow.click();
    await expect(page.locator("button", { hasText: "Retry tool" })).toBeVisible();
    await expect(page.locator("pre").filter({ hasText: "fail()" })).toBeVisible();
  });

  test("replays a failed tool execution and updates the entry", async ({ page }) => {
    const chatBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/studio/chat/**", async (route) => {
      chatBodies.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: FAILING_TOOL_SSE,
      });
    });
    const replayBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/studio/tools/execute/**", async (route) => {
      replayBodies.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "fixed value" }),
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "run the failing tool");

    const toolRow = page.locator("button[aria-expanded]").filter({ hasText: "code_execution" });
    await expect(toolRow).toBeVisible({ timeout: 10000 });
    await toolRow.click();
    await page.locator("button", { hasText: "Retry tool" }).click();

    // The failed call flips to complete with the re-executed result.
    await expect(page.locator("pre").filter({ hasText: "fixed value" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button", { hasText: "Retry tool" })).toHaveCount(0);
    await expect(toolRow).not.toContainText("boom");

    // One-shot contract: after the first verification the cookie covers chat and
    // tool replay, so no Turnstile token is submitted to either endpoint.
    expect(replayBodies[0]?.tool).toBe("code_execution");
    expect(replayBodies[0]?.args).toEqual({ code: "fail()" });
    expect(chatBodies[0]?.turnstileToken).toBeUndefined();
    expect(replayBodies[0]?.turnstileToken).toBeUndefined();
  });
});