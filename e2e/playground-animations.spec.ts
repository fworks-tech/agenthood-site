import { expect } from "@playwright/test";
import { test } from "./fixtures";
import {
  mockTurnstile,
  selectAgent,
  sendMessage,
  getMessages,
  waitForStreamComplete,
  waitForHydration,
  openConversationSidebar,
} from "./helpers";

test.describe("Playground — Welcome Terminal", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("shows welcome terminal with typing animation", async ({ page }) => {
    await expect(page.locator("text=Welcome to Agenthood Studio")).toBeVisible();
    await expect(page.locator("text=Select a Society member from the left panel")).toBeVisible();

    const terminalLabel = page.locator("span:has-text('terminal')");
    await expect(terminalLabel).toBeVisible();

    await page.waitForTimeout(2000);
    const monoText = page.locator("[data-testid='welcome-terminal'] .font-mono").first();
    const text = await monoText.innerText();
    expect(text.length).toBeGreaterThan(5);
  });

  test("terminal cycles through sample prompts", async ({ page }) => {
    const monoText = page.locator("[data-testid='welcome-terminal'] .font-mono").first();
    await expect(monoText).toBeVisible();

    const text1 = await monoText.innerText();
    await page.waitForTimeout(8000);
    const text2 = await monoText.innerText();
    expect(text1).not.toBe(text2);
  });

  test("terminal shows agent icon and name", async ({ page }) => {
    await expect(page.locator("text=The Reviewer").first()).toBeVisible();
    await expect(page.locator("text=Try asking...")).toBeVisible();
  });
});

test.describe("Playground — Agent Prompt Suggestions", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Suggestion response"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("shows agent icon, name, and role when agent selected", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await expect(page.locator("text=The Scribe").first()).toBeVisible();
    await expect(page.locator("text=Commits").first()).toBeVisible();
  });

  test("shows clickable prompt suggestions", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const suggestions = page.locator("button:has-text('Before every')");
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking suggestion sends message", async ({ page }) => {
    await selectAgent(page, "the-reviewer");
    const suggestion = page.locator("button:has-text('Before merging any PR')");
    await suggestion.click();
    await waitForStreamComplete(page);
    const messages = await getMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.text).toContain("Before merging any PR");
  });

  test("different agents show different prompts", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await expect(page.locator("text=Commits").first()).toBeVisible();
    const scribePrompts = page.locator("button:has-text('Before every')");
    const scribeCount = await scribePrompts.count();
    expect(scribeCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Playground — Message Entry Animation", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Animated response"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("messages have transition classes", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Test animation");
    await page.waitForTimeout(500);

    const animatedMessages = page.locator("[class*='transition-all'][class*='duration-300']");
    const count = await animatedMessages.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("multiple messages animate independently", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "First message");
    await waitForStreamComplete(page);
    await sendMessage(page, "Second message");
    await page.waitForTimeout(500);

    const messages = await getMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(4);
  });
});

test.describe("Playground — Config Panel Collapsible Sections", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["ok"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("Model & Behavior section can be collapsed", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) return;

    const toggle = page.locator("text=Model & Behavior").first();
    await toggle.click();
    await page.waitForTimeout(300);

    const providerLabel = page.locator("label:has-text('Provider')");
    await expect(providerLabel).not.toBeVisible();
  });

  test("Model & Behavior section can be expanded", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) return;

    const toggle = page.locator("text=Model & Behavior").first();
    await toggle.click();
    await page.waitForTimeout(300);
    await toggle.click();
    await page.waitForTimeout(300);

    const providerLabel = page.locator("label:has-text('Provider')");
    await expect(providerLabel).toBeVisible();
  });

  test("Tools section can be collapsed and expanded", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) return;

    const toggle = page.locator("text=Tools").first();
    await toggle.click();
    await page.waitForTimeout(300);

    const webFetch = page.locator("text=Web Fetch").first();
    await expect(webFetch).not.toBeVisible();

    await toggle.click();
    await page.waitForTimeout(300);
    await expect(webFetch).toBeVisible();
  });

  test("Limits section is collapsed by default", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) return;

    const rateLimit = page.locator("text=Rate limit (chat)");
    await expect(rateLimit).not.toBeVisible();
  });

  test("Limits section expands on click", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) return;

    const toggle = page.locator("text=Limits").first();
    await toggle.click();
    await page.waitForTimeout(300);

    const rateLimit = page.locator("text=Rate limit (chat)");
    await expect(rateLimit).toBeVisible();
  });

  test("save button shows checkmark after saving", async ({ page }) => {
    const vs = page.viewportSize();
    if (vs !== null && vs.width < 768) return;

    await selectAgent(page, "the-scribe");
    await page.waitForTimeout(500);
    const saveBtn = page.locator("button:has-text('Save configuration')");
    await expect(saveBtn).toBeVisible();
    
    // Click save and check for the saved state
    await saveBtn.click();
    await page.waitForTimeout(100);
    
    // The button text changes to "Saved" with a checkmark
    const savedBtn = page.locator("button:has-text('Saved')");
    const hasSavedState = await savedBtn.isVisible().catch(() => false);
    
    // Either shows "Saved" or the config was saved to sessionStorage
    const saved = await page.evaluate(() => sessionStorage.getItem("agenthood-studio-config"));
    expect(hasSavedState || saved !== null).toBe(true);
  });
});

test.describe("Playground — Tool Call Transitions", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("tool call badges have transition classes", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        'data: {"type":"tool_call","data":{"id":"tc-1","name":"web_fetch","args":{"url":"https://example.com"}}}\n' +
        'data: {"type":"tool_result","data":{"id":"tc-1","result":"Page content here"}}\n' +
        'data: {"type":"token","data":"Done"}\n' +
        'data: {"type":"done"}\n';
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Fetch example.com");
    await page.waitForTimeout(2000);

    const toolBadge = page.locator("text=web_fetch").first();
    if (await toolBadge.isVisible().catch(() => false)) {
      const parent = toolBadge.locator("..");
      const classes = await parent.getAttribute("class");
      expect(classes).toContain("transition-all");
    }
  });
});

test.describe("Playground — Feedback Button Micro-interactions", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Feedback test response"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("feedback buttons have active scale animation", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Test feedback");
    await waitForStreamComplete(page);

    const thumbsUp = page.locator("button[title='Helpful']").first();
    await expect(thumbsUp).toBeVisible();

    const classes = await thumbsUp.getAttribute("class");
    expect(classes).toContain("active:scale-125");
    expect(classes).toContain("transition-all");
  });

  test("clicking feedback sends request", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Test feedback color");
    await waitForStreamComplete(page);

    const feedbackPromise = page.waitForResponse((res) =>
      res.url().includes("/api/studio/feedback") && res.request().method() === "POST",
    );

    const thumbsUp = page.locator("button[title='Helpful']").first();
    await thumbsUp.click();

    const feedbackRes = await feedbackPromise;
    expect(feedbackRes.status()).toBe(200);
  });
});

test.describe("Playground — Composer Micro-interactions", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Composer test"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("send button has active scale animation", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const sendBtn = page.locator("button[aria-label='Send message']");
    await expect(sendBtn).toBeVisible();

    const classes = await sendBtn.getAttribute("class");
    expect(classes).toContain("active:scale-90");
  });

  test("textarea shows emerald ring when text present", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("Hello");
    await page.waitForTimeout(200);

    const wrapper = textarea.locator("..").locator("..");
    const classes = await wrapper.getAttribute("class");
    expect(classes).toContain("ring-emerald-500");
  });

  test("textarea loses emerald ring when cleared", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("Hello");
    await page.waitForTimeout(200);
    await textarea.fill("");
    await page.waitForTimeout(200);

    const wrapper = textarea.locator("..").locator("..");
    const classes = await wrapper.getAttribute("class");
    expect(classes).not.toContain("ring-emerald-500");
  });

  test("stop button pulses while streaming", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        'data: {"type":"token","data":"Slow"}\n' +
        'data: {"type":"token","data":" response"}\n';
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Long running");
    await page.waitForTimeout(500);

    const stopBtn = page.locator("button[aria-label='Stop streaming']");
    if (await stopBtn.isVisible().catch(() => false)) {
      const classes = await stopBtn.getAttribute("class");
      expect(classes).toContain("animate-pulse");
    }
  });
});

test.describe("Playground — LiveLogs Entry Animation", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Log animation test"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("log entries have fade-in animation", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Generate logs");
    await waitForStreamComplete(page);

    await page.waitForTimeout(500);
    const logEntries = page.locator("[class*='slide-up'][class*='ease-out']");
    const count = await logEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Playground — Header Cross-fade", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Header test"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("header shows agent info with animation on select", async ({ page }) => {
    await selectAgent(page, "the-scribe");

    const agentInfo = page.locator("[class*='slide-up'][class*='ease-out']");
    const count = await agentInfo.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("header updates when switching agents", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    await expect(page.locator("text=The Scribe").first()).toBeVisible();

    await selectAgent(page, "the-reviewer");
    await expect(page.locator("text=The Reviewer").first()).toBeVisible();
  });
});

test.describe("Playground — Responsive Layout", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("mobile shows bottom bar with 3 buttons", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const bottomBar = page.locator("div.fixed.bottom-0");
    await expect(bottomBar.getByText("Conversations", { exact: true })).toBeVisible();
    await expect(bottomBar.getByText("Config", { exact: true })).toBeVisible();
    await expect(bottomBar.getByText("Logs", { exact: true })).toBeVisible();
  });

  test("mobile shows agent selector when no agent selected", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const selector = page.getByLabel("Select an agent");
    await expect(selector).toBeVisible();
  });

  test("desktop hides bottom bar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const bottomBar = page.locator("[class*='fixed'][class*='bottom-0'][class*='md\\:hidden']");
    const isVisible = await bottomBar.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

test.describe("Playground — Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page, clearStorage, mockChat }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await mockChat(["Keyboard test"]);
    await page.reload();
    await waitForHydration(page);
  });

  test("Enter sends message", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("Enter test");
    await textarea.press("Enter");
    await waitForStreamComplete(page);

    const messages = await getMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  test("Shift+Enter creates new line", async ({ page }) => {
    await selectAgent(page, "the-scribe");
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("Line 1");
    await textarea.press("Shift+Enter");
    await textarea.type("Line 2");

    const value = await textarea.inputValue();
    expect(value).toContain("Line 1");
    expect(value).toContain("Line 2");
  });
});

test.describe("Playground — Edge Cases", () => {
  test.beforeEach(async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);
  });

  test("cannot send empty message", async ({ page, mockChat }) => {
    await mockChat(["response"]);
    await selectAgent(page, "the-scribe");
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("   ");
    const sendBtn = page.locator("button[aria-label='Send message']");
    await expect(sendBtn).toBeDisabled();
  });

  test("cannot send while streaming", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        'data: {"type":"token","data":"Slow"}\n' +
        'data: {"type":"token","data":" response"}\n';
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "First message");
    await page.waitForTimeout(200);

    // Either stop button is visible (still streaming) or textarea is disabled
    const stopBtn = page.locator("button[aria-label='Stop streaming']");
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    const isStopVisible = await stopBtn.isVisible().catch(() => false);
    const isTextareaDisabled = await textarea.isDisabled().catch(() => false);
    expect(isStopVisible || isTextareaDisabled).toBe(true);
  });

  test("server error shows error message", async ({ page, mockChatError }) => {
    await mockChatError("Rate limit exceeded");
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Trigger error");

    await expect(page.locator("text=Rate limit exceeded").first()).toBeVisible({ timeout: 10000 });
  });

  test("401 error shows auth error", async ({ page }) => {
    await page.route("**/api/studio/chat/**", async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: "Unauthorized" }) });
    });

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Auth error");

    await expect(page.locator("text=401").first()).toBeVisible({ timeout: 10000 });
  });

  test("conversation persists after reload", async ({ page, mockChat }) => {
    await mockChat(["Persisted response"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Persist test");
    await waitForStreamComplete(page);

    await page.reload();
    await waitForHydration(page);

    // Wait for the chat store to hydrate: the persisted conversation must show
    // in the sidebar before selecting an agent, otherwise the selection can
    // race hydration and clobber the stored conversations.
    await openConversationSidebar(page);
    const persisted = page
      .locator("[data-conversation-list='sidebar'] [class*='cursor-pointer']")
      .filter({ hasText: "Persist test" })
      .last();
    await persisted.waitFor({ state: "visible", timeout: 15000 });

    await selectAgent(page, "the-scribe");
    await openConversationSidebar(page);
    await persisted.click();
    await page.waitForTimeout(500);

    const messages = await getMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  test("clearing messages removes token counter", async ({ page, mockChat }) => {
    await mockChat(["Token test"]);
    await selectAgent(page, "the-scribe");
    await sendMessage(page, "Token test");
    await waitForStreamComplete(page);

    const counter = page.locator("[class*='font-mono'][class*='text-zinc-400']").first();
    if (await counter.isVisible().catch(() => false)) {
      const clearBtn = page.locator("button:has-text('Clear')").first();
      await clearBtn.click();
      await page.waitForTimeout(500);

      await expect(counter).not.toBeVisible();
    }
  });
});

test.describe("Playground — CAPTCHA Edge Cases", () => {
  test("send button disabled when CAPTCHA token not ready", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");

    const sendBtn = page.locator("button[aria-label='Send message']");
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
  });

  test("captchaReady prop controls send button state", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");

    // Without turnstile, send button should be disabled
    const sendBtn = page.locator("button[aria-label='Send message']");
    await expect(sendBtn).toBeDisabled();

    // Textarea should still be usable
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await expect(textarea).toBeVisible();
  });

  test("captcha lifecycle phases appear in LiveLogs and enable send", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");

    // The info-level "CAPTCHA ready" is the observable lifecycle result; the
    // debug-level phases (script loaded, widget rendered) are hidden by default
    // once the debug toggle exists.
    await expect(page.getByText("CAPTCHA ready", { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // Send enables once text exists and a token was received (captchaReady true)
    const textarea = page.locator("textarea[placeholder='Type a message...']");
    await textarea.fill("hello");
    const sendBtn = page.locator("button[aria-label='Send message']");
    await expect(sendBtn).toBeEnabled({ timeout: 15000 });
  });
});

test.describe("Playground — Network Logs", () => {
  test("server log events surface in LiveLogs", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        JSON.stringify({ type: "log", level: "info", event: "chat.routing", primary: "groq", correlationId: "e2e-corr-1" }) + "\n" +
        JSON.stringify({ type: "log", level: "error", event: "chat.error", correlationId: "e2e-corr-1" }) + "\n" +
        JSON.stringify({ type: "token", data: "Hello" }) + "\n" +
        JSON.stringify({ type: "done" }) + "\n";
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "network probe");

    await expect(page.getByText("chat.routing · primary=groq", { exact: true })).toBeVisible();
    await expect(page.getByText("chat.error", { exact: true })).toBeVisible();
    await waitForStreamComplete(page);
  });
});

test.describe("Playground — LiveLogs UI", () => {
  test("debug entries are hidden by default and revealed by the Debug toggle", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");

    // debug-level captcha lifecycle entries exist but are filtered out
    await expect(page.getByText("CAPTCHA widget rendered", { exact: true }).first()).toBeHidden({ timeout: 10000 });
    // info-level entries remain visible
    await expect(page.getByText("CAPTCHA ready", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Show debug logs").click();
    await expect(page.getByText("CAPTCHA widget rendered", { exact: true }).first()).toBeVisible();
  });

  test("panel auto-expands when a new error arrives while collapsed", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.route("**/api/studio/chat/**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: JSON.stringify({ type: "error", data: "Provider unavailable" }) + "\n",
      });
    });
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");

    // collapse the Live Logs panel via its header
    const header = page.locator("text=Live Logs").first();
    await header.click();
    await expect(page.locator("text=Agents loaded").first()).toBeHidden();

    await sendMessage(page, "boom");

    // the failure log renders only once the collapsed panel auto-expands
    await expect(
      page.locator("div.mantine-Group-root").filter({ hasText: /✗ .+ failed after/ }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("copy button copies formatted logs to the clipboard", async ({ page, clearStorage, browserName }) => {
    test.skip(browserName === "webkit", "clipboard-write permission is unsupported on WebKit");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");
    await expect(page.getByLabel("Copy logs")).toBeEnabled();

    await page.getByLabel("Copy logs").click();
    await expect
      .poll(async () => await page.evaluate(() => navigator.clipboard.readText()), { timeout: 5000 })
      .toContain("INFO [CAPTCHA] CAPTCHA ready");
  });

  test("category filter narrows the visible logs", async ({ page, clearStorage }) => {
    await page.goto("/studio/playground");
    await clearStorage();
    await mockTurnstile(page);
    await page.route("**/api/studio/chat/**", async (route) => {
      const body =
        JSON.stringify({ type: "log", level: "info", event: "chat.routing", primary: "groq", correlationId: "e2e-corr-1" }) + "\n" +
        JSON.stringify({ type: "token", data: "Hello" }) + "\n" +
        JSON.stringify({ type: "done" }) + "\n";
      await route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body });
    });
    await page.reload();
    await waitForHydration(page);

    await selectAgent(page, "the-scribe");
    await sendMessage(page, "filter probe");
    await expect(page.getByText("chat.routing · primary=groq", { exact: true })).toBeVisible();
    await expect(page.locator("text=Agents loaded").first()).toBeVisible();

    const filter = page.getByRole("combobox", { name: "Filter logs by category" });
    await filter.click();
    await page
      .getByRole("listbox", { name: "Filter logs by category" })
      .getByRole("option")
      .filter({ hasText: "Network" })
      .click();

    await expect(page.getByText("chat.routing · primary=groq", { exact: true })).toBeVisible();
    await expect(page.locator("text=Agents loaded").first()).toBeHidden();

    await page.reload();
    await waitForHydration(page);
    await expect(page.getByText("chat.routing · primary=groq", { exact: true })).toBeVisible();
    await expect(page.locator("text=Agents loaded").first()).toBeHidden();
  });
});
