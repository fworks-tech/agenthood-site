import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const articles = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "news", "manifest.json"), "utf8")) as {
    slug: string[];
    title: string;
  }[]
).map((entry) => ({ slug: entry.slug[0], title: entry.title }));

test.describe("News Section", () => {
  test("news index loads and shows at least one post", async ({ page }) => {
    await page.goto("/news", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1")).toContainText("News");
    await expect(page.locator("text=Incident reports, release notes, and project updates")).toBeVisible();

    const posts = page.locator("main a[href*='/news/']");
    const count = await posts.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking a post navigates to the post page", async ({ page }) => {
    await page.goto("/news", { waitUntil: "domcontentloaded" });

    const firstPost = page.locator("main a[href*='/news/']").first();
    await expect(firstPost).toBeVisible();

    const href = await firstPost.getAttribute("href");
    await firstPost.click();

    await expect(page).toHaveURL(href ?? "/news/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("manifest lists at least one article so the per-article checks are not vacuous", async () => {
    expect(articles.length).toBeGreaterThan(0);
  });

  for (const { slug, title } of articles) {
    test(`article /news/${slug} renders its title as the h1`, async ({ page }) => {
      await page.goto(`/news/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toHaveText(title);
    });
  }

  test("article pages do not render front matter as content", async ({ page }) => {
    await page.goto("/news/automated-review-followup", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("text=/^date: \\d{4}-\\d{2}-\\d{2}$/")).toHaveCount(0);
    await expect(page.locator("text=/^author: Agenthood Team$/")).toHaveCount(0);
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
