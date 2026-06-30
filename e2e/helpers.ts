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
      await page.waitForFunction((id) => {
        const ms = document.querySelector("select[aria-label='Select an agent']") as HTMLSelectElement | null;
        if (!ms) return false;
        for (let i = 0; i < ms.options.length; i++) {
          if (ms.options[i].value === id && !ms.disabled) return true;
        }
        return false;
      }, agentId, { timeout: 10000 });
      await mobileSelect.selectOption(agentId, { force: true });
      await page.waitForTimeout(300);
      return;
    }
    // Mobile select hidden (agent already selected). Open config panel for desktop select.
    const openBtn = page.getByRole("button", { name: "Open config panel" });
    let openVisible = false;
    try {
      await openBtn.waitFor({ state: "visible", timeout: 3000 });
      openVisible = true;
    } catch {
      openVisible = false;
    }
    if (openVisible) {
      await openBtn.click();
      await page.waitForTimeout(300);
    }
  }

  await page.waitForFunction((id) => {
    const selects = document.querySelectorAll("select");
    for (const s of selects) {
      for (let i = 0; i < s.options.length; i++) {
        if (s.options[i].value === id && !s.disabled) return true;
      }
    }
    return false;
  }, agentId, { timeout: 10000 });

  const select = page.getByLabel("Agent", { exact: true });
  await select.selectOption(agentId, { force: true });
  await page.waitForTimeout(300);
}

export async function closeConfigPanel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const backdrop = document.querySelector('[class*="bg-black/50"]');
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
  const userBubbles = page.locator("div.flex.justify-end").filter({ has: page.locator(".rounded-lg.bg-zinc-800") });
  const assistantBubbles = page.locator("div.flex.justify-start").filter({ has: page.locator(".rounded-lg.bg-zinc-900") });

  const userCount = await userBubbles.count();
  const assistantCount = await assistantBubbles.count();

  for (let i = 0; i < userCount; i++) {
    const text = await userBubbles.nth(i).locator(".rounded-lg").innerText();
    messages.push({ role: "user", text });
  }
  for (let i = 0; i < assistantCount; i++) {
    const text = await assistantBubbles.nth(i).locator(".rounded-lg").innerText();
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
  const items = page.locator("[class*='group']").filter({ has: page.locator(".truncate") });

  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const title = await item.locator(".truncate").innerText();
    const classAttr = await item.getAttribute("class") || "";
    const active = classAttr.includes("border-emerald-500");
    entries.push({ title, active });
  }
  return entries;
}

export async function getLogEntries(page: Page): Promise<{ time: string; level: string; message: string }[]> {
  const logs: { time: string; level: string; message: string }[] = [];
  const logLines = page.locator("text=Live Logs").locator("..").locator("..").locator("div.flex.items-start.gap-2");

  const count = await logLines.count();
  for (let i = 0; i < count; i++) {
    const line = logLines.nth(i);
    const time = await line.locator("span").first().innerText();
    const levelEl = line.locator("span.rounded");
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
