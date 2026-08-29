import { describe, it, expect } from "vitest";
import {
  serializeConversationJson,
  serializeConversationMarkdown,
  conversationFilename,
  EXPORT_FORMAT,
  EXPORT_VERSION,
} from "../app/(main)/studio/_lib/export-conversation";
import type { Conversation } from "../app/(main)/studio/_hooks/useStudioChat";

const conversation: Conversation = {
  id: "conv-1",
  agentId: "the-scribe",
  title: "Commit message help",
  messages: [
    { id: "m1", role: "user", content: "Write a commit message" },
    {
      id: "m2",
      role: "assistant",
      content: "Done.",
      toolCalls: [
        { id: "t1", name: "web_fetch", args: { url: "https://github.com/x" }, result: "fetched", status: "complete" },
        { id: "t2", name: "code_execution", args: { code: "1+1" }, error: "Error: boom", status: "error" },
      ],
    },
  ],
  config: {
    provider: "opencode-go",
    model: "deepseek-v4-flash",
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: "Be brief.",
    enabledTools: ["web_fetch"],
    baseUrl: "https://user:tok@api.example.com/v1",
    apiKey: "sk-secret",
  },
  createdAt: 1234567890,
  tokenCount: 42,
};

describe("conversation export", () => {
  it("serializes a versioned JSON envelope", () => {
    const data = JSON.parse(serializeConversationJson(conversation));
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.version).toBe(EXPORT_VERSION);
    expect(data.conversation.messages).toHaveLength(2);
    expect(data.conversation.messages[1].toolCalls).toHaveLength(2);
    expect(data.conversation.messages[1].toolCalls[1].error).toContain("boom");
  });

  it("withholds secrets from the JSON export via the config allow-list", () => {
    const text = serializeConversationJson(conversation);
    expect(text).not.toContain("sk-secret");
    expect(text).not.toContain("api.example.com");
    const data = JSON.parse(text);
    expect(data.conversation.config.apiKey).toBeUndefined();
    expect(data.conversation.config.baseUrl).toBeUndefined();
  });

  it("exports only the allow-listed config fields", () => {
    const data = JSON.parse(serializeConversationJson(conversation));
    expect(data.conversation.config).toEqual({
      provider: "opencode-go",
      model: "deepseek-v4-flash",
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: "Be brief.",
      enabledTools: ["web_fetch"],
    });
  });

  it("serializes a human-readable markdown transcript", () => {
    const text = serializeConversationMarkdown(conversation);
    expect(text).toContain("# Commit message help");
    expect(text).toContain("## User");
    expect(text).toContain("## Assistant");
    expect(text).toContain("`web_fetch`");
    expect(text).toContain("fetched");
    expect(text).toContain("boom");
    expect(text).not.toContain("sk-secret");
  });

  it("omits the tools section when a message has no tool calls", () => {
    const text = serializeConversationMarkdown({
      ...conversation,
      messages: [{ id: "m1", role: "user", content: "hi" }],
    });
    expect(text).not.toContain("**Tools:**");
  });

  it("builds safe filenames, including for untitled conversations", () => {
    expect(conversationFilename(conversation, "md")).toBe("agenthood-conversation-commit-message-help.md");
    expect(conversationFilename(conversation, "json")).toBe("agenthood-conversation-commit-message-help.json");
    expect(conversationFilename({ ...conversation, title: "" }, "json")).toBe("agenthood-conversation-conversation.json");
  });
});