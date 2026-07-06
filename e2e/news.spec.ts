import { test, expect } from "@playwright/test";

test.describe("News Section", () => {
  test("news index loads and shows at least one post", async ({ page }) => {
    await page.goto("/news");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("News");
    await expect(page.locator("text=Incident reports, release notes, and project updates")).toBeVisible();

    const posts = page.locator("main a[href*='/news/']");
    const count = await posts.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking a post navigates to the post page", async ({ page }) => {
    await page.goto("/news");
    await page.waitForLoadState("networkidle");

    const firstPost = page.locator("main a[href*='/news/']").first();
    await expect(firstPost).toBeVisible();

    const href = await firstPost.getAttribute("href");
    await firstPost.click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(href ?? "/news/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("all articles render without error", async ({ page }) => {
    const slugs = ["playground-hardening", "recent-updates", "vercel-speed-insights", "outage-post-mortem", "docs-audit", "ci-refinement"];
    for (const slug of slugs) {
      await page.goto(`/news/${slug}`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("RSS feed returns XML with correct content type", async ({ page }) => {
    const response = await page.goto("/news/rss.xml");
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/rss+xml");

    const text = await response?.text();
    expect(text).toContain("<rss version=\"2.0\"");
    expect(text).toContain("<item>");
  });
});
