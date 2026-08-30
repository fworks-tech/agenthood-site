import type { Conversation } from "../_hooks/useStudioChat";
import type { ChatMessage } from "./studio-api";
import type { ChatConfig } from "../_types/studio";

export const EXPORT_FORMAT = "agenthood-conversation";
export const EXPORT_VERSION = 1;

export interface ConversationExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  conversation: {
    id: string;
    agentId: string;
    title: string;
    createdAt: number;
    tokenCount: number;
    config: Partial<ChatConfig>;
    messages: ChatMessage[];
  };
}

// Allow-list of config fields that are safe to export. Anything not listed
// (apiKey, baseUrl with possible embedded credentials, future secrets) is
// withheld by default instead of being scrubbed one field at a time.
const EXPORTABLE_CONFIG_FIELDS = [
  "provider",
  "model",
  "temperature",
  "maxTokens",
  "systemPrompt",
  "enabledTools",
] as const satisfies readonly (keyof ChatConfig)[];

function redactConfig(config: Partial<ChatConfig>): Partial<ChatConfig> {
  const out: Partial<ChatConfig> = {};
  for (const field of EXPORTABLE_CONFIG_FIELDS) {
    const value = config[field];
    if (value === undefined) continue;
    (out as Record<string, unknown>)[field] = value;
  }
  return out;
}

export function serializeConversationJson(conversation: Conversation): string {
  const exportData: ConversationExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    conversation: {
      id: conversation.id,
      agentId: conversation.agentId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      tokenCount: conversation.tokenCount,
      config: redactConfig(conversation.config),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls ?? undefined,
      })),
    },
  };
  return JSON.stringify(exportData, null, 2);
}

function sanitizeForCodeBlock(text: string): string {
  return text.replaceAll('```', '\\`\\`\\`');
}

export function serializeConversationMarkdown(conversation: Conversation): string {
  const provider = conversation.config?.provider ?? "unknown";
  const model = conversation.config?.model ?? "unknown";
  const lines: string[] = [
    `# ${conversation.title}`,
    "",
    `- Agent: ${conversation.agentId}`,
    `- Provider: ${provider} · Model: ${model}`,
    `- Exported: ${new Date().toISOString()}`,
    `- Tokens: ~${conversation.tokenCount ?? 0}`,
    "",
    "---",
    "",
  ];

  for (const message of conversation.messages) {
    const label = message.role === "user" ? "User" : "Assistant";
    lines.push(`## ${label}`, "");
    lines.push(message.content || "(empty)", "");

    if (message.toolCalls && message.toolCalls.length > 0) {
      lines.push("**Tools:**", "");
      for (const toolCall of message.toolCalls) {
        lines.push(`- \`${toolCall.name}\` args:`, "");
        lines.push("```json");
        lines.push(JSON.stringify(toolCall.args, null, 2));
        lines.push("```");
        if (toolCall.result) {
          lines.push("", "  Result:", "");
          lines.push("```text");
          lines.push(sanitizeForCodeBlock(toolCall.result));
          lines.push("```");
        }
        if (toolCall.error) {
          lines.push("", "  Error:", "");
          lines.push("```text");
          lines.push(sanitizeForCodeBlock(toolCall.error));
          lines.push("```");
        }
      }
      lines.push("");
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}

export function conversationFilename(conversation: Conversation, extension: "json" | "md"): string {
  const slug =
    conversation.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "conversation";
  return `agenthood-conversation-${slug}.${extension}`;
}

export function downloadBlob(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
