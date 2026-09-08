/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const STORAGE_KEY = "agenthood-studio-custom-tools";

function okResponse(body: string, contentType = "text/plain") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => contentType },
    text: async () => body,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("custom-tools", () => {
  it("validates custom tool names", async () => {
    const { isValidCustomToolName } = await import("../app/(main)/studio/_lib/custom-tools");
    expect(isValidCustomToolName("custom_weather")).toBe(true);
    expect(isValidCustomToolName("custom_api_v2")).toBe(true);
    expect(isValidCustomToolName("web_fetch")).toBe(false);
    expect(isValidCustomToolName("code_execution")).toBe(false);
    expect(isValidCustomToolName("Custom_Weather")).toBe(false);
    expect(isValidCustomToolName("custom-weather")).toBe(false);
    expect(isValidCustomToolName("custom_")).toBe(false);
    expect(isValidCustomToolName("")).toBe(false);
  });

  it("registers and retrieves custom tools", async () => {
    const { registerCustomTool, getCustomTools } = await import("../app/(main)/studio/_lib/custom-tools");
    const def = {
      name: "custom_weather",
      description: "Get weather for a city",
      inputSchema: {
        type: "object" as const,
        properties: { city: { type: "string", description: "City name" } },
        required: ["city"],
      },
      executionType: "webhook" as const,
      webhookUrl: "https://api.example.com/weather",
    };
    expect(registerCustomTool(def)).toEqual({ ok: true });
    const tools = getCustomTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("custom_weather");
  });

  it("rejects duplicate tool names", async () => {
    const { registerCustomTool } = await import("../app/(main)/studio/_lib/custom-tools");
    const def = {
      name: "custom_weather",
      description: "Get weather",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    };
    registerCustomTool(def);
    const result = registerCustomTool(def);
    expect(result).toEqual({ ok: false, error: 'Tool "custom_weather" already exists' });
  });

  it("rejects invalid tool names", async () => {
    const { registerCustomTool } = await import("../app/(main)/studio/_lib/custom-tools");
    const result = registerCustomTool({
      name: "invalid-name",
      description: "test",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    expect(result.ok).toBe(false);
  });

  it("unregisters custom tools", async () => {
    const { registerCustomTool, unregisterCustomTool, getCustomTools } = await import("../app/(main)/studio/_lib/custom-tools");
    registerCustomTool({
      name: "custom_weather",
      description: "Get weather",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    unregisterCustomTool("custom_weather");
    expect(getCustomTools()).toHaveLength(0);
  });

  it("persists custom tools to localStorage", async () => {
    const { registerCustomTool } = await import("../app/(main)/studio/_lib/custom-tools");
    registerCustomTool({
      name: "custom_weather",
      description: "Get weather",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("custom_weather");
  });

  it("generates ToolSchema from custom tools", async () => {
    const { registerCustomTool, getCustomToolSchemas } = await import("../app/(main)/studio/_lib/custom-tools");
    registerCustomTool({
      name: "custom_weather",
      description: "Get weather for a city",
      inputSchema: {
        type: "object" as const,
        properties: { city: { type: "string", description: "City name" } },
        required: ["city"],
      },
      executionType: "webhook" as const,
    });
    const schemas = getCustomToolSchemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0].name).toBe("custom_weather");
    expect(schemas[0].description).toBe("Get weather for a city");
    expect(schemas[0].inputSchema.required).toEqual(["city"]);
  });

  it("getToolSchemas includes custom tools", async () => {
    const { registerCustomTool } = await import("../app/(main)/studio/_lib/custom-tools");
    const { getToolSchemas } = await import("../app/(main)/studio/_lib/tools");
    registerCustomTool({
      name: "custom_weather",
      description: "Get weather",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    const schemas = getToolSchemas();
    const names = schemas.map((s) => s.name);
    expect(names).toContain("web_fetch");
    expect(names).toContain("code_execution");
    expect(names).toContain("custom_weather");
  });

  it("executeTool returns not-implemented for custom tools", async () => {
    const { executeTool } = await import("../app/(main)/studio/_lib/tools");
    const result = await executeTool("custom_weather", {});
    expect(result).toBe('Error: custom tool "custom_weather" execution not yet implemented');
  });

  it("rejects tool names exceeding 64 characters", async () => {
    const { registerCustomTool } = await import("../app/(main)/studio/_lib/custom-tools");
    const longName = "custom_" + "a".repeat(60);
    const result = registerCustomTool({
      name: longName,
      description: "test",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    expect(result.ok).toBe(false);
  });

  it("enforces maximum custom tool limit", async () => {
    const { registerCustomTool } = await import("../app/(main)/studio/_lib/custom-tools");
    for (let i = 0; i < 50; i++) {
      registerCustomTool({
        name: `custom_tool${i}`,
        description: "test",
        inputSchema: { type: "object" as const, properties: {} },
        executionType: "webhook" as const,
      });
    }
    const result = registerCustomTool({
      name: "custom_one_too_many",
      description: "test",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    expect(result).toEqual({ ok: false, error: "Maximum 50 custom tools allowed" });
  });

  it("getCustomToolSchemas caches results", async () => {
    const { registerCustomTool, getCustomToolSchemas } = await import("../app/(main)/studio/_lib/custom-tools");
    registerCustomTool({
      name: "custom_cached",
      description: "Test caching",
      inputSchema: { type: "object" as const, properties: {} },
      executionType: "webhook" as const,
    });
    const first = getCustomToolSchemas();
    const second = getCustomToolSchemas();
    expect(first).toBe(second);
  });
});
