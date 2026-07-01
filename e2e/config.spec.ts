import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent } from "./helpers";

test.describe("Playground — Configuration", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["ok"]);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await selectAgent(page, "the-scribe");
  });

  test("changing provider updates model dropdown", async ({ page }) => {
    const providerSelect = page.getByLabel("Provider", { exact: true });
    const modelSelect = page.getByLabel("Model", { exact: true });
    const initialModel = await modelSelect.inputValue();

    await providerSelect.selectOption("openai");
    await page.waitForTimeout(200);
    const newModel = await modelSelect.inputValue();
    expect(newModel).not.toBe(initialModel);
  });

  test("base url input shown for ollama, hidden for anthropic", async ({ page }) => {
    const providerSelect = page.getByLabel("Provider", { exact: true });

    await providerSelect.selectOption("anthropic");
    await page.waitForTimeout(200);
    const baseUrlInput = page.locator("input[placeholder*='localhost']");
    await expect(baseUrlInput).not.toBeVisible();

    await providerSelect.selectOption("ollama");
    await page.waitForTimeout(200);
    await expect(baseUrlInput).toBeVisible();
  });

  test("temperature slider updates displayed value", async ({ page }) => {
    const label = page.locator("text=/Temperature: \\d\\.\\d/");
    await expect(label).toBeVisible();
    const slider = page.getByLabel(/^Temperature/);
    await slider.fill("1.5");
    await page.waitForTimeout(200);
    await expect(page.locator("text=Temperature: 1.5")).toBeVisible();
  });

  test("max tokens slider updates displayed value", async ({ page }) => {
    const slider = page.getByLabel(/^Max Tokens/);
    await slider.fill("8192");
    await page.waitForTimeout(200);
    await expect(page.locator("text=Max Tokens: 8,192")).toBeVisible();
  });

  test("save persists config to sessionStorage", async ({ page }) => {
    const providerSelect = page.getByLabel("Provider", { exact: true });
    await providerSelect.selectOption("openai");
    await page.waitForTimeout(200);

    await page.locator("button:has-text('Save configuration')").click();
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => sessionStorage.getItem("agenthood-studio-config"));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved || "{}");
    expect(parsed.provider).toBe("openai");
  });

  test("config restored on page reload", async ({ page }) => {
    const providerSelect = page.getByLabel("Provider", { exact: true });
    await providerSelect.selectOption("groq");
    await page.waitForTimeout(200);
    await page.locator("button:has-text('Save configuration')").click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for agents to finish loading
    await expect(page.getByText("Agents loaded").first()).toBeVisible({ timeout: 15000 });

    const openBtn = page.getByRole("button", { name: "Open config panel" });
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
      await page.locator('[data-config-panel]').waitFor({ state: 'visible', timeout: 5000 });
    }

    const restoredProvider = await page.getByLabel("Provider", { exact: true }).inputValue();
    expect(restoredProvider).toBe("groq");
  });

  test("api key input accepts text and shows placeholder", async ({ page }) => {
    const openBtn = page.getByRole("button", { name: "Open config panel" });
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
      await page.locator('[data-config-panel]').waitFor({ state: 'visible', timeout: 5000 });
    }
    const keyInput = page.locator("input[type=password]");
    await expect(keyInput).toBeVisible();
    await keyInput.fill("sk-test-key-123");
    await page.waitForTimeout(200);
    const value = await keyInput.inputValue();
    expect(value).toBe("sk-test-key-123");
  });
});
