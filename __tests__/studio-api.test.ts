import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendChat } from "../app/(main)/studio/_lib/studio-api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const messages = [{ role: "user" as const, content: "hello" }];
const config = { provider: "anthropic" as const, temperature: 0.7 };

describe("sendChat", () => {
  it("posts to the chat route with a JSON body", async () => {
    fetchMock.mockResolvedValue(new Response());
    await sendChat("the-scribe", messages, config, "tok-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/studio/chat/");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      agentId: "the-scribe",
      messages,
      config,
      turnstileToken: "tok-1",
    });
  });

  it("omits X-Correlation-Id when none is provided", async () => {
    fetchMock.mockResolvedValue(new Response());
    await sendChat("the-scribe", messages, config, "tok-1");
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-Correlation-Id");
  });

  it("adds X-Correlation-Id when provided", async () => {
    fetchMock.mockResolvedValue(new Response());
    await sendChat("the-scribe", messages, config, "tok-1", "sess-9");
    expect(fetchMock.mock.calls[0][1].headers["X-Correlation-Id"]).toBe("sess-9");
  });

  it("forwards the abort signal to fetch", async () => {
    fetchMock.mockResolvedValue(new Response());
    const controller = new AbortController();
    await sendChat("the-scribe", messages, config, "tok-1", "sess-9", controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("returns the fetch Response", async () => {
    const response = new Response();
    fetchMock.mockResolvedValue(response);
    await expect(sendChat("the-scribe", messages, config)).resolves.toBe(response);
  });
});