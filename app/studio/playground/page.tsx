"use client";

import { useState, useCallback } from "react";
import { useAgentDirectory } from "../_hooks/useAgentDirectory";
import { useStudioChat } from "../_hooks/useStudioChat";
import AgentConfigPanel from "../_components/AgentConfigPanel";
import MessageList from "../_components/MessageList";
import ChatComposer from "../_components/ChatComposer";
import LiveLogs from "../_components/LiveLogs";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig } from "../_types/chat-config";
import { getDefaultModel } from "../_types/chat-config";
import type { LogEntry } from "../_components/LiveLogs";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

export default function PlaygroundPage() {
  const { agents } = useAgentDirectory();
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);
  const [config, setConfig] = useState<ChatConfig>({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev.slice(-99), { time, level, message }]);
  }, []);

  const chat = useStudioChat({ config });

  const handleSendMessage = useCallback(async (content: string) => {
    addLog("info", `agent=${selectedAgent?.id} sending message`);
    try {
      await chat.sendMessage(content);
      addLog("info", `agent=${selectedAgent?.id} response complete`);
    } catch (err) {
      addLog("error", `agent=${selectedAgent?.id} ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [chat, selectedAgent, addLog]);

  const handleSelectAgent = useCallback((agent: AgentEntry) => {
    setSelectedAgent(agent);
    const defaultModel = getDefaultModel(agent.preferredProvider);
    setConfig((prev) => ({
      ...prev,
      provider: agent.preferredProvider as ChatConfig["provider"],
      model: defaultModel,
    }));
    chat.newConversation(agent.id);
    addLog("info", `agent selected: ${agent.id}`);
  }, [chat, addLog]);

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Left Column — Agent Configuration */}
      <div className="hidden w-72 shrink-0 md:block">
        <AgentConfigPanel
          agents={agents}
          selectedAgent={selectedAgent}
          config={config}
          onChangeConfig={setConfig}
          onChangeAgent={handleSelectAgent}
        />
      </div>

      {/* Right Column — Chat + Logs */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <div>
            <h1 className="text-sm font-semibold text-zinc-200">Playground</h1>
            <p className="text-xs text-zinc-500">Test agents, prompts, and controls in a live chat UI.</p>
          </div>
          {selectedAgent && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-zinc-300">{selectedAgent.name}</span>
              <span className="text-xs text-zinc-600">&amp;middot; {selectedAgent.role}</span>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {selectedAgent ? (
            chat.messages.length > 0 ? (
              <MessageList messages={chat.messages} isStreaming={chat.isStreaming} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center px-6">
                  <p className="text-sm text-zinc-500">
                    Start a conversation with <span className="text-zinc-300 font-medium">{selectedAgent.name}</span>.
                    Your prompt is validated and rate-limited server-side.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md text-center px-6">
                <h2 className="text-lg font-semibold text-zinc-300">Welcome to Agenthood Studio</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Select a Society member from the left panel to start testing. Configure provider, model, temperature, and more.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        {selectedAgent && (
          <ChatComposer
            onSend={handleSendMessage}
            onStop={chat.abortStream}
            isStreaming={chat.isStreaming}
          />
        )}

        {/* Mobile agent selector (visible when no agent selected on small screens) */}
        {!selectedAgent && (
          <div className="block border-t border-zinc-800 p-4 md:hidden">
            <select
              value=""
              onChange={(e) => {
                const agent = agents.find((a) => a.id === e.target.value);
                if (agent) handleSelectAgent(agent);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="" disabled>Select an agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.role}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Logs */}
        <LiveLogs logs={logs} />
      </div>
    </div>
  );
}
