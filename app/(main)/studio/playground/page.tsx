"use client";

import { useState, useCallback } from "react";
import { useAgentDirectory } from "../_hooks/useAgentDirectory";
import { useStudioChat } from "../_hooks/useStudioChat";
import AgentConfigPanel from "../_components/AgentConfigPanel";
import MessageList from "../_components/MessageList";
import ChatComposer from "../_components/ChatComposer";
import LiveLogs from "../_components/LiveLogs";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig, Provider } from "../_types/studio";
import { getDefaultModel } from "../_types/studio";
import { agentSkills } from "../_data/agents.generated";
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
  const [configOpen, setConfigOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(true);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev.slice(-99), { time, level, message }]);
  }, []);

  const chat = useStudioChat({ config });

  const handleSendMessage = useCallback(async (content: string) => {
    if (!selectedAgent) return;
    const ts = Date.now();
    addLog("info", `→ ${selectedAgent.name} · ${config.provider} · ${config.model}`);
    try {
      await chat.sendMessage(content);
      const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
      addLog("info", `✓ ${selectedAgent.name} completed in ${elapsed}s`);
    } catch (err) {
      const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
      addLog("error", `✗ ${selectedAgent.name} failed after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [chat, selectedAgent, config.provider, config.model, addLog]);

  const handleSelectAgent = useCallback((agent: AgentEntry) => {
    const provider = agent.preferredProvider as Provider;
    const model = getDefaultModel(provider);
    const prompt = agentSkills[agent.id] ?? DEFAULT_SYSTEM_PROMPT;
    setSelectedAgent(agent);
    setConfig((prev) => ({ ...prev, provider, model, systemPrompt: prompt }));
    chat.newConversation(agent.id);
    addLog("info", `Selected: ${agent.name} · ${agent.role} · ${provider}/${model}`);
    if (!configOpen) setConfigOpen(true);
  }, [chat, addLog, configOpen]);

  const handleConfigChange = useCallback((newConfig: ChatConfig) => {
    if (newConfig.provider !== config.provider || newConfig.model !== config.model) {
      addLog("info", `Config: ${newConfig.provider} · ${newConfig.model}`);
    }
    setConfig(newConfig);
  }, [config.provider, config.model, addLog]);

  return (
    <div className="relative flex h-screen bg-zinc-950 max-w-7xl mx-auto">
      {/* Left Column — Agent Configuration */}
      <div
        className={`${
          configOpen ? "w-72" : "w-0"
        } shrink-0 transition-all duration-200 overflow-hidden border-r border-zinc-800`}
      >
        <AgentConfigPanel
          agents={agents}
          selectedAgent={selectedAgent}
          config={config}
          onChangeConfig={handleConfigChange}
          onChangeAgent={handleSelectAgent}
        />
      </div>

      {/* Toggle config panel button */}
      <button
        onClick={() => setConfigOpen(!configOpen)}
        className={`absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-r-md border border-l-0 border-zinc-700 bg-zinc-900 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors ${
          configOpen ? "left-72" : "left-0"
        }`}
        style={{ transition: "left 200ms" }}
        aria-label={configOpen ? "Close config panel" : "Open config panel"}
      >
        <svg className={`h-4 w-4 transition-transform duration-200 ${configOpen ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

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
              <span className="text-xs text-zinc-600">· {config.provider} · {config.model}</span>
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

        {/* Mobile agent selector */}
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
        <LiveLogs logs={logs} open={logsOpen} onToggle={() => setLogsOpen(!logsOpen)} />
      </div>
    </div>
  );
}
