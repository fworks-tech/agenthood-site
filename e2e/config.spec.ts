import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mockTurnstile, selectAgent, selectMantineOption } from "./helpers";

function skipOnMobile(page: { viewportSize: () => { width: number } | null }) {
  const vs = page.viewportSize();
  if (vs && vs.width < 768) {
    test.skip("Config panel tests require desktop viewport");
  }
}

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
    skipOnMobile(page);
    const modelSelect = page.getByLabel("Model", { exact: true });
    const initialModel = await modelSelect.inputValue();
    await selectMantineOption(page, "Provider", "OpenAI");
    await page.waitForTimeout(200);
    const newModel = await modelSelect.inputValue();
    expect(newModel).not.toBe(initialModel);
  });

  test("base url input shown for ollama, hidden for anthropic", async ({ page }) => {
    skipOnMobile(page);
    await selectMantineOption(page, "Provider", "Anthropic");
    await page.waitForTimeout(200);
    const baseUrlInput = page.locator("input[placeholder*='localhost']");
    await expect(baseUrlInput).not.toBeVisible();

    await selectMantineOption(page, "Provider", "Ollama (local)");
    await page.waitForTimeout(200);
    await expect(baseUrlInput).toBeVisible();
  });

  test("temperature slider updates displayed value", async ({ page }) => {
    skipOnMobile(page);
    const label = page.locator("label:has-text('Temperature:')");
    await expect(label).toBeVisible();
    const forAttr = await label.getAttribute("for");
    const sliderRoot = page.locator(`[id="${forAttr}"]`);
    const box = await sliderRoot.boundingBox();
    if (box) {
      const ratio = 1.5 / 2;
      await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
    }
    await page.waitForTimeout(200);
    await expect(page.locator("text=Temperature: 1.5")).toBeVisible();
  });

  test("max tokens slider updates displayed value", async ({ page }) => {
    skipOnMobile(page);
    const label = page.locator("label:has-text('Max Tokens:')");
    await expect(label).toBeVisible();
    const forAttr = await label.getAttribute("for");
    const sliderRoot = page.locator(`[id="${forAttr}"]`);
    const box = await sliderRoot.boundingBox();
    if (box) {
      const ratio = (8192 - 256) / (16384 - 256);
      await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
    }
    await page.waitForTimeout(200);
    await expect(page.locator("text=Max Tokens: 8,192")).toBeVisible();
  });

  test("save persists config to sessionStorage", async ({ page }) => {
    skipOnMobile(page);
    await selectMantineOption(page, "Provider", "OpenAI");
    await page.waitForTimeout(200);

    await page.locator("button:has-text('Save configuration')").click();
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => sessionStorage.getItem("agenthood-studio-config"));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved || "{}");
    expect(parsed.provider).toBe("openai");
  });

  test("config restored on page reload", async ({ page }) => {
    skipOnMobile(page);
    await selectMantineOption(page, "Provider", "Groq");
    await page.waitForTimeout(200);
    await page.locator("button:has-text('Save configuration')").click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for agents to finish loading
    await expect(page.getByText("Agents loaded").first()).toBeVisible({ timeout: 15000 });

    // Wait for CSS transition to settle, then force-click to bypass actionability check
    const openBtn = page.getByRole("button", { name: "Open config panel" });
    try {
      await openBtn.waitFor({ state: "visible", timeout: 5000 });
      await page.waitForTimeout(300);
      await openBtn.click({ force: true });
      await page.locator('[data-config-panel]').waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // panel is already open
    }

    const restoredProvider = await page.getByLabel("Provider", { exact: true }).inputValue();
    expect(restoredProvider).toBe("Groq");
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
