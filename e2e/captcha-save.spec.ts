import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, waitForHydration, openConfigPanel, readTurnstileResetCount, resetTurnstileCounter, expireAndReissue, runTurnstileIssueResolvers } from "./helpers";

async function waitForSaveEnabled(
  page: import("@playwright/test").Page,
  saveBtn: import("@playwright/test").Locator,
) {
  await expect
    .poll(
      async () => {
        await runTurnstileIssueResolvers(page);
        return saveBtn.count();
      },
      { timeout: 5000 },
    )
    .toBeGreaterThan(0);
  await expect(saveBtn).toBeEnabled();
}

test.describe("Playground — Captcha-gated Save", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await resetTurnstileCounter(page);
  });

  test("desktop save shows Verify to save and stays disabled until captcha verifies", async ({ page }) => {
    await mockTurnstile(page, { autoVerify: false });
    await page.reload();
    await waitForHydration(page);
    await selectAgent(page, "the-scribe");

    const panel = page.locator("[data-config-panel]");
    const gated = panel.getByRole("button", { name: "Verify to save" });
    await expect(gated).toBeVisible({ timeout: 5000 });
    await expect(gated).toBeDisabled();

    await waitForSaveEnabled(page, panel.getByRole("button", { name: "Save configuration" }));
    await expect(gated).toHaveCount(0);
  });

  test("save stays enabled when the verified captcha token expires and re-verifies", async ({ page }) => {
    await mockTurnstile(page, { autoVerify: false });
    await page.reload();
    await waitForHydration(page);
    await selectAgent(page, "the-scribe");

    const panel = page.locator("[data-config-panel]");
    await waitForSaveEnabled(page, panel.getByRole("button", { name: "Save configuration" }));

    // Expiry + background re-verification must not invalidate the verified token:
    // the save button stays enabled and is never replaced by "Verify to save".
    await expireAndReissue(page);
    // The mock runs autoVerify off, so the re-issued token is queued rather than
    // delivered — flush it to stand in for Cloudflare's background re-verification.
    await runTurnstileIssueResolvers(page);

    await expect(panel.getByRole("button", { name: "Save configuration" })).toBeEnabled({ timeout: 5000 });
    expect(await readTurnstileResetCount(page)).toBe(0);
  });

  test("mobile config sheet receives a captcha token so save becomes enabled", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockTurnstile(page, { autoVerify: false });
    await page.reload();
    await waitForHydration(page);
    await selectAgent(page, "the-scribe");
    await openConfigPanel(page);

    const sheet = page.locator(".mantine-Drawer-body");
    const gated = sheet.getByRole("button", { name: "Verify to save" });
    await expect(gated).toBeVisible({ timeout: 5000 });
    await expect(gated).toBeDisabled();

    await waitForSaveEnabled(page, sheet.getByRole("button", { name: "Save configuration" }));
  });
});
