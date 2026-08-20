import { expect } from "@playwright/test";
import { test } from "./fixtures";

test.describe("Footer version badge", () => {
  test("shows the version returned by the registry via data?.version", async ({ page }) => {
    await page.route("**/registry.npmjs.org/agenthood/latest", (route) =>
      route.fulfill({ json: { version: "9.9.9-test" } }),
    );
    await page.goto("/");
    const badge = page.locator("footer").locator(".mantine-Badge-root").last();
    await expect(badge).toContainText("v9.9.9-test");
  });

  test("falls back to the pinned version when the registry fetch fails", async ({ page }) => {
    await page.route("**/registry.npmjs.org/agenthood/latest", (route) => route.abort());
    await page.goto("/");
    const badge = page.locator("footer").locator(".mantine-Badge-root").last();
    await expect(badge).toContainText("v3.36.0");
  });
});
