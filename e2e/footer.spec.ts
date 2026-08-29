import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { AGENTHOOD_VERSION } from "../app/_lib/agenthood-version";

test.describe("Footer version badge", () => {
  test("shows the installed agenthood version from the shared build-time constant", async ({ page }) => {
    await page.goto("/");
    const badge = page.locator("footer").locator(".mantine-Badge-root").last();
    await expect(badge).toContainText(`v${AGENTHOOD_VERSION}`);
  });

  test("does not depend on the npm registry", async ({ page }) => {
    await page.route("**/registry.npmjs.org/**", (route) => route.abort());
    await page.goto("/");
    const badge = page.locator("footer").locator(".mantine-Badge-root").last();
    await expect(badge).toContainText(`v${AGENTHOOD_VERSION}`);
  });
});
