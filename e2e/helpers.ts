import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export async function mockTurnstile(page: Page): Promise<void> {
  await page.route("**/challenges.cloudflare.com/turnstile/**", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.turnstile = {
          render: function(container, options) {
            setTimeout(function() { options.callback("TEST_TOKEN_123"); }, 50);
            return "widget-id";
          },
          remove: function() {}
        };
        if (window.onloadTurnstileCallback) window.onloadTurnstileCallback();
      `,
    });
  });
}

export async function selectMantineOption(page: Page, label: string, optionText: string): Promise<void> {
  const input = page.getByLabel(label, { exact: true });
  await input.click();
  const option = page.locator(`[role="option"]`).filter({ hasText: optionText }).or(
    page.locator(`[data-combobox-option]`).filter({ hasText: optionText }).first()
  );
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
}

export async function selectAgent(page: Page, agentId: string): Promise<void> {
  const vs = page.viewportSize();
  const isMobile = vs !== null && vs.width < 768;

  if (isMobile) {
    const mobileSelect = page.getByLabel("Select an agent");
    let mobileVisible = false;
    try {
      await mobileSelect.waitFor({ state: "visible", timeout: 3000 });
      mobileVisible = true;
    } catch {
      mobileVisible = false;
    }
    if (mobileVisible) {
      await mobileSelect.selectOption(agentId, { force: true });
      await page.waitForTimeout(300);
      return;
    }
  }

  // Desktop: open config panel and use Mantine Select
  const openBtn = page.getByRole("button", { name: "Open config panel" });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(300);
  }

  const agentSelect = page.getByLabel("Agent", { exact: true });
  await agentSelect.click();
  await page.waitForTimeout(200);
  const agentName = agentId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const option = page.locator(`[role="option"]`).filter({ hasText: agentName });
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await page.waitForTimeout(300);
}

export async function openConfigPanel(page: Page): Promise<void> {
  const vs = page.viewportSize();
  const isMobile = vs !== null && vs.width < 768;
  if (isMobile) {
    const configBtn = page.getByText("Config", { exact: true });
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
      await page.waitForTimeout(300);
    }
    return;
  }
  const openBtn = page.getByRole("button", { name: "Open config panel" });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(300);
  }
}

export async function closeConfigPanel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const backdrop = document.querySelector('.mantine-Overlay-root, [class*="bg-black/50"]');
    if (backdrop) (backdrop as HTMLElement).click();
  });
  await page.waitForTimeout(300);
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  const vs = page.viewportSize();
  if (vs !== null && vs.width < 768) {
    await closeConfigPanel(page);
  }
  const textarea = page.locator("textarea[placeholder='Type a message...']");
  await textarea.waitFor({ state: "visible", timeout: 5000 });
  await textarea.fill(text);
  await page.waitForTimeout(100);
  await textarea.press("Enter");
}

export async function getMessages(page: Page): Promise<{ role: string; text: string }[]> {
  const messages: { role: string; text: string }[] = [];
  const userBubbles = page.locator("div.flex.justify-end").filter({ has: page.locator(".mantine-Paper-root") });
  const assistantBubbles = page.locator("div.flex.justify-start").filter({ has: page.locator(".mantine-Paper-root") });

  const userCount = await userBubbles.count();
  const assistantCount = await assistantBubbles.count();

  for (let i = 0; i < userCount; i++) {
    const text = await userBubbles.nth(i).locator(".mantine-Paper-root").innerText();
    messages.push({ role: "user", text });
  }
  for (let i = 0; i < assistantCount; i++) {
    const text = await assistantBubbles.nth(i).locator(".mantine-Paper-root").innerText();
    messages.push({ role: "assistant", text });
  }

  return messages;
}

export async function getConversationEntries(page: Page): Promise<{ title: string; active: boolean }[]> {
    const vs = page.viewportSize();
    const isMobile = vs !== null && vs.width < 768;
    if (isMobile) {
      const closeBtn = page.getByRole("button", { name: "Close config panel" });
      if (!(await closeBtn.isVisible().catch(() => false))) {
        const openBtn = page.getByRole("button", { name: "Open config panel" });
        if (await openBtn.isVisible().catch(() => false)) {
          await openBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }

    const entries: { title: string; active: boolean }[] = [];
    const sidebar = page.locator("[data-conversation-list='sidebar']");
    if (await sidebar.count() === 0) {
      const openBtn = page.getByRole("button", { name: "Open config panel" });
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
        await page.waitForTimeout(300);
      }
    }
    // Wait for sidebar to be attached
    await sidebar.waitFor({ state: 'attached', timeout: 10000 });
    if (await sidebar.count() === 0) return entries;
    
    // Wait for at least one conversation item to be attached
    const items = sidebar.locator("[class*='cursor-pointer']");
    await items.first().waitFor({ state: 'attached', timeout: 10000 });
    
    const count = await items.count();
    if (count === 0) return entries;
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const titleLocator = item.locator("div.flex-1 .mantine-Text-root").first();
      await titleLocator.waitFor({ state: "attached", timeout: 10000 });
      const title = await titleLocator.innerText();
      const classAttr = await item.getAttribute("class") || "";
      const active = classAttr.includes("border-emerald-500");
      entries.push({ title, active });
    }
    return entries;
  }

export async function getLogEntries(page: Page): Promise<{ time: string; level: string; message: string }[]> {
  const logs: { time: string; level: string; message: string }[] = [];
  const logLines = page.locator("text=Live Logs").locator("..").locator("..").locator(".mantine-Group-root");

  const count = await logLines.count();
  for (let i = 0; i < count; i++) {
    const line = logLines.nth(i);
    const time = await line.locator("span").first().innerText();
    const levelEl = line.locator(".mantine-Badge-root");
    const level = await levelEl.innerText();
    const message = await line.locator("span").last().innerText();
    logs.push({ time, level, message });
  }
  return logs;
}

export async function waitForStreamComplete(page: Page): Promise<void> {
  await expect(page.locator("text=completed in").first()).toBeVisible({ timeout: 15000 });
}

export async function getTokenCounter(page: Page): Promise<Locator | null> {
  const counter = page.locator("text=/~\\d+ tok/").first();
  if (await counter.isVisible().catch(() => false)) return counter;
  return null;
}

/** Floating Companion helpers */

export async function openCompanion(page: Page): Promise<void> {
  const balloon = page.getByRole("button", { name: "Open assistant" });
  await balloon.waitFor({ state: "visible", timeout: 5000 });
  // force:true because the floating CSS animation makes Playwright see it as unstable
  await balloon.click({ force: true });
  await page.waitForTimeout(500);
}

export async function closeCompanion(page: Page): Promise<void> {
  const closeBtn = page.getByRole("button", { name: "Close assistant" });
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

export async function sendCompanionMessage(page: Page, text: string): Promise<void> {
  const textarea = page.locator("textarea[placeholder='Ask anything...']");
  await textarea.waitFor({ state: "visible", timeout: 5000 });
  await textarea.fill(text);
  await page.waitForTimeout(100);
  await textarea.press("Enter");
  await page.waitForTimeout(300);
}
