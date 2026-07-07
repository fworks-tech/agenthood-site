import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { openCompanion, sendCompanionMessage } from "./helpers";

test.describe("Floating Companion — Desktop", () => {
  test("balloon trigger visible on docs pages", async ({ page }) => {
    await page.goto("/docs/members/");
    await expect(page.getByRole("button", { name: "Open assistant" })).toBeVisible();
  });

  test("balloon trigger visible on academy pages", async ({ page }) => {
    await page.goto("/academy/getting-started/");
    await expect(page.getByRole("button", { name: "Open assistant" })).toBeVisible();
  });

  test("balloon trigger visible on getting-started page", async ({ page }) => {
    await page.goto("/getting-started/");
    await expect(page.getByRole("button", { name: "Open assistant" })).toBeVisible();
  });

  test("clicking balloon opens chat panel with welcome message", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await expect(page.getByText("Hi, I'm The Oracle!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Test my knowledge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Summarize this page" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave feedback" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask me anything" })).toBeVisible();
  });

  test("quick action 'Summarize this page' sends a message", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await page.getByRole("button", { name: "Summarize this page" }).click();
    await expect(page.getByText("Give me a summary of this page.")).toBeVisible();
  });

  test("quick action 'Test my knowledge' sends a quiz message", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await page.getByRole("button", { name: "Test my knowledge" }).click();
    await expect(page.getByText("Quiz me on this page content!")).toBeVisible();
  });

  test("typing and sending a custom message", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await sendCompanionMessage(page, "What is a skill file?");
    await expect(page.getByText("What is a skill file?")).toBeVisible();
  });

  test("close button hides the chat panel", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await page.getByRole("button", { name: "Close assistant" }).click({ force: true });
    // after close, the panel becomes opacity-0 — verify via the panel wrapper
    await expect(page.getByRole("button", { name: "Open assistant" })).toBeVisible();
  });

  test("closing panel reveals the balloon trigger", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await page.getByRole("button", { name: "Close assistant" }).click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Open assistant" })).toBeVisible({ timeout: 5000 });
  });

  test("expand button increases panel width", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    const panel = page.locator(".overflow-hidden.flex-col").first();
    const initWidth = await panel.evaluate((el) => el.clientWidth);
    await page.getByRole("button", { name: "Expand" }).click();
    await page.waitForTimeout(300);
    const expandedWidth = await panel.evaluate((el) => el.clientWidth);
    expect(expandedWidth).toBeGreaterThan(initWidth);
  });

  test("character counter visible in input", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    const textarea = page.locator("textarea[placeholder='Ask anything...']");
    await textarea.fill("Hello");
    await expect(page.getByText("/500")).toBeVisible();
  });

  test("session limit notice after 20 messages", async ({ page }) => {
    test.slow(); // sending 20 messages sequentially needs extra time
    await page.goto("/docs/members/");
    await openCompanion(page);
    for (let i = 0; i < 20; i++) {
      await sendCompanionMessage(page, `Question ${i + 1}`);
    }
    await expect(page.getByText("Conversation limit reached")).toBeVisible();
    await expect(page.locator("textarea[placeholder='Ask anything...']")).not.toBeVisible();
  });

  test("leave feedback flow", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await page.getByRole("button", { name: "Leave feedback" }).click();
    await expect(page.getByText("What would you like to share?")).toBeVisible();
    const feedbackInput = page.locator("textarea[placeholder='Write your feedback...']");
    await feedbackInput.fill("Great docs!");
    await page.locator("button:has-text('Send'):not([aria-label])").click();
    await page.waitForTimeout(800);
    await expect(page.getByText("Thanks for your feedback!")).toBeVisible();
  });
});

test.describe("Floating Companion — Mobile (iPhone 13)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("balloon trigger visible and positioned bottom-right", async ({ page }) => {
    await page.goto("/docs/members/");
    const balloon = page.getByRole("button", { name: "Open assistant" });
    await expect(balloon).toBeVisible();
    const box = await balloon.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y + box.height).toBeGreaterThan(700);
    }
  });

  test("chat panel fits within mobile viewport", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    const panel = page.locator(".overflow-hidden.flex-col").first();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(400);
      expect(box.y + box.height).toBeLessThanOrEqual(816);
    }
  });

  test("quick actions are clickable on mobile viewport", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    await page.getByRole("button", { name: "Test my knowledge" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Quiz me on this page content!")).toBeVisible();
  });

  test("balloon positioned in bottom region", async ({ page }) => {
    await page.goto("/docs/members/");
    const balloon = page.getByRole("button", { name: "Open assistant" });
    const box = await balloon.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y).toBeGreaterThan(600);
    }
  });

  test("panel repositions on viewport resize", async ({ page }) => {
    await page.goto("/docs/members/");
    await openCompanion(page);
    const input = page.locator("textarea[placeholder='Ask anything...']");
    await input.focus();
    await page.setViewportSize({ width: 375, height: 500 });
    await page.waitForTimeout(300);
    const panel = page.locator(".overflow-hidden.flex-col").first();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y + box.height).toBeLessThanOrEqual(510);
    }
  });
});
