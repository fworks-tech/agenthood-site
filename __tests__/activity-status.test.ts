import { describe, it, expect } from "vitest";
import { chatStatusLabel } from "../app/(main)/studio/_components/ActivityStatus";

describe("chatStatusLabel", () => {
  it("returns null when not streaming", () => {
    expect(chatStatusLabel(false, [{ name: "web_fetch", status: "pending" }])).toBeNull();
    expect(chatStatusLabel(undefined)).toBeNull();
  });

  it("returns Thinking when streaming without tools", () => {
    expect(chatStatusLabel(true)).toBe("Thinking");
    expect(chatStatusLabel(true, [])).toBe("Thinking");
  });

  it("returns null during content streaming without pending tools when fallback is null", () => {
    expect(chatStatusLabel(true, [], null)).toBeNull();
  });

  it("still labels a pending tool when fallback is null", () => {
    expect(
      chatStatusLabel(true, [{ name: "code_execution", status: "running" }], null),
    ).toBe("Running code");
  });

  it("caps very long hostnames", () => {
    const host = `${"a".repeat(50)}.${"b".repeat(50)}.${"c".repeat(50)}.com`;
    expect(
      chatStatusLabel(true, [{ name: "web_fetch", status: "pending", args: { url: `https://${host}/x` } }]),
    ).toBe(`Fetching ${host.slice(0, 60)}`);
  });

  it("labels a pending web_fetch with the target host", () => {
    expect(
      chatStatusLabel(true, [{ name: "web_fetch", status: "pending", args: { url: "https://github.com/fworks-tech/atlaslink" } }]),
    ).toBe("Fetching github.com");
  });

  it("falls back to Fetching URL for an unparseable url", () => {
    expect(chatStatusLabel(true, [{ name: "web_fetch", status: "pending", args: { url: "::bad::" } }])).toBe("Fetching URL");
    expect(chatStatusLabel(true, [{ name: "web_fetch", status: "pending" }])).toBe("Fetching URL");
    expect(chatStatusLabel(true, [{ name: "web_fetch", status: "pending", args: { url: 123 } }])).toBe("Fetching URL");
  });

  it("labels code_execution and custom tools", () => {
    expect(chatStatusLabel(true, [{ name: "code_execution", status: "running" }])).toBe("Running code");
    expect(chatStatusLabel(true, [{ name: "custom_weather", status: "pending" }])).toBe("Running custom tool");
    expect(chatStatusLabel(true, [{ name: "something_else", status: "pending" }])).toBe("Exploring");
  });

  it("treats a nameless pending tool as Exploring instead of throwing", () => {
    expect(
      chatStatusLabel(true, [{ name: undefined, status: "pending" } as unknown as { name: string; status: string }]),
    ).toBe("Exploring");
  });

  it("ignores completed tools and falls back", () => {
    expect(
      chatStatusLabel(true, [{ name: "web_fetch", status: "complete" }, { name: "code_execution", status: "error" }]),
    ).toBe("Thinking");
    expect(
      chatStatusLabel(true, [{ name: "web_fetch", status: "complete" }], null),
    ).toBeNull();
  });
});
