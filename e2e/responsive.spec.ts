import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile } from "./helpers";

test.describe("Playground — Responsive Layout", () => {
  async function setup(page: any, width: number, height: number, clearStorage: any) {
    await page.setViewportSize({ width, height });
    await page.goto("/studio/playground");
    await mockTurnstile(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await clearStorage();
    await page.reload();
    await page.waitForLoadState("networkidle");
  }

  test("config panel overlays on mobile", async ({ page, clearStorage }) => {
    await setup(page, 375, 812, clearStorage);
    const toggleBtn = page.getByRole("button", { name: "Open config panel" });
    await toggleBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Agent Configuration")).toBeVisible({ timeout: 10000 });
    const backdrop = page.locator(".fixed.inset-0.bg-black\\/50");
    await expect(backdrop).toBeVisible();
  });

  test("mobile agent selector visible when no agent selected", async ({ page, clearStorage }) => {
    await setup(page, 375, 812, clearStorage);
    const mobileSelect = page.locator("select[aria-label='Select an agent']");
    await expect(mobileSelect).toBeVisible({ timeout: 10000 });
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
