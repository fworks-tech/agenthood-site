import { expect } from "@playwright/test";
import { test, buildChatSSEBody } from "./fixtures";
import { mockTurnstile, waitForHydration, selectAgent, sendMessage, waitForStreamComplete } from "./helpers";

test.describe("Playground — Responsive Layout", () => {
  async function setup(page: import("@playwright/test").Page, width: number, height: number, clearStorage: () => Promise<void>) {
    await page.setViewportSize({ width, height });
    await page.goto("/studio/playground");
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
    await clearStorage();
    await page.reload();
    await waitForHydration(page);
  }

  test("config opens in the bottom sheet on mobile, no in-page overlay", async ({ page, clearStorage }) => {
    await setup(page, 375, 812, clearStorage);
    // The desktop sidebar plus its header toggle are desktop-only on mobile.
    await expect(page.getByRole("button", { name: "Open config panel" })).toBeHidden();
    const backdrop = page.locator(".fixed.inset-0.bg-black\\/50");
    await expect(backdrop).toBeHidden();

    const configBtn = page.locator("div.fixed.bottom-0.left-0.right-0 button").filter({ hasText: "Config" }).last();
    await configBtn.click();
    await expect(page.locator("text=Agent Configuration")).toBeVisible({ timeout: 10000 });
  });

  test("mobile agent selector visible when no agent selected", async ({ page, clearStorage }) => {
    await setup(page, 375, 812, clearStorage);
    const mobileSelect = page.locator("select[aria-label='Select an agent']");
    await expect(mobileSelect).toBeVisible({ timeout: 10000 });
  });

  test("composer stays fully visible and usable above the fixed bottom bar", async ({ page, clearStorage }) => {
    await setup(page, 375, 812, clearStorage);
    await page.route("**/api/studio/chat/**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildChatSSEBody(["ok"]),
      }),
    );
    await selectAgent(page, "the-scribe");

    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await expect(textarea).toBeVisible({ timeout: 10000 });
    const bar = page.locator("div.fixed.bottom-0.left-0.right-0");
    const textareaBox = await textarea.boundingBox();
    const barBox = await bar.boundingBox();
    expect(textareaBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    // The composer must sit entirely above the bottom bar so the send button stays tappable.
    expect(textareaBox!.y + textareaBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
  });

  test("long assistant content does not overflow the mobile viewport", async ({ page, clearStorage }) => {
    await setup(page, 375, 812, clearStorage);
    const longCode = "A".repeat(600);
    await page.route("**/api/studio/chat/**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildChatSSEBody([
          'Here is a long code block:\n\n```\n' + longCode + '\n```\nFin.',
        ]),
      }),
    );
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "show the long block");
    await waitForStreamComplete(page);

    const overflowsPage = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflowsPage).toBeFalsy();

    // The code block scrolls internally rather than forcing the page wide.
    const pre = page.locator("pre").first();
    await expect(pre).toBeVisible();
    const preBox = await pre.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(preBox!.width).toBeLessThanOrEqual(viewportWidth);
  });

  test("config panel side-by-side on desktop", async ({ page, clearStorage }) => {
    await setup(page, 1280, 720, clearStorage);
    await expect(page.locator("text=Agent Configuration")).toBeVisible({ timeout: 10000 });
  });

  test("no backdrop overlay on desktop", async ({ page, clearStorage }) => {
    await setup(page, 1280, 720, clearStorage);
    const backdrop = page.locator(".fixed.inset-0.bg-black\\/50");
    await expect(backdrop).toBeHidden();
  });

  test("toggle button opens and closes config panel", async ({ page, clearStorage }) => {
    await setup(page, 1280, 720, clearStorage);
    const toggleBtn = page.locator("button[aria-label='Close config panel']");
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });

    await toggleBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Agent Configuration")).not.toBeVisible();
  });
});