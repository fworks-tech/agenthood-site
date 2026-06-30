"use client";

import { useState, useCallback, useEffect } from "react";
import { useAgentDirectory } from "../_hooks/useAgentDirectory";
import { useStudioChat } from "../_hooks/useStudioChat";
import AgentConfigPanel from "../_components/AgentConfigPanel";
import MessageList from "../_components/MessageList";
import ChatComposer from "../_components/ChatComposer";
import LiveLogs from "../_components/LiveLogs";
import ConversationList from "../_components/ConversationList";
import Turnstile from "../../../components/Turnstile";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig, Provider } from "../_types/studio";
import { getDefaultModel } from "../_types/studio";
import { agentSkills } from "../_data/agents.generated";
import type { LogEntry } from "../_components/LiveLogs";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

function loadSavedConfig(): Partial<ChatConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("agenthood-studio-config");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function PlaygroundPage() {
  const { agents, isLoading, error } = useAgentDirectory();
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);
  const [config, setConfig] = useState<ChatConfig>(() => ({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    ...loadSavedConfig(),
  }));
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [configOpen, setConfigOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(true);

  useEffect(() => {
    setConfigOpen(window.innerWidth >= 768);
  }, []);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev.slice(-99), { time, level, message }]);
  }, []);

  const chat = useStudioChat({ config, turnstileToken: turnstileToken ?? undefined });
  const { conversations, activeConversationId } = chat;

  useEffect(() => {
    if (!isLoading && !error) {
      addLog("info", `Agents loaded: ${agents.length} available`);
      const saved = loadSavedConfig();
      if (saved.provider) {
        addLog("info", `Loaded saved config: ${saved.provider} · ${saved.model ?? "default"}`);
      }
    }
  }, [isLoading, error, agents.length, addLog]);

  useEffect(() => {
    if (turnstileToken) {
      addLog("info", "CAPTCHA ready");
    }
  }, [turnstileToken, addLog]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!selectedAgent) return;
    if (!turnstileToken) {
      addLog("warn", "CAPTCHA token not ready yet. Please wait a moment.");
      return;
    }
    const ts = Date.now();
    addLog("info", `→ ${selectedAgent.icon ?? ""} ${selectedAgent.name} · ${config.provider} · ${config.model}`);
    try {
      await chat.sendMessage(content);
      const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
      addLog("info", `✓ ${selectedAgent.icon ?? ""} ${selectedAgent.name} completed in ${elapsed}s`);
    } catch (err) {
      const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
      addLog("error", `✗ ${selectedAgent.icon ?? ""} ${selectedAgent.name} failed after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [chat, selectedAgent, config.provider, config.model, addLog, turnstileToken]);

  const handleSaveConfig = useCallback((cfg: ChatConfig) => {
    try {
      localStorage.setItem("agenthood-studio-config", JSON.stringify(cfg));
      addLog("info", "Configuration saved locally");
    } catch {
      addLog("error", "Failed to save configuration");
    }
  }, [addLog]);

  const handleSelectAgent = useCallback((agent: AgentEntry) => {
    const provider = agent.preferredProvider as Provider;
    const model = getDefaultModel(provider);
    const prompt = agentSkills[agent.id] ?? DEFAULT_SYSTEM_PROMPT;
    setSelectedAgent(agent);
    setConfig((prev) => ({ ...prev, provider, model, systemPrompt: prompt }));
    chat.newConversation(agent.id);
    addLog("info", `Selected: ${agent.icon ?? ""} ${agent.name} · ${agent.role} · ${provider}/${model}`);
    if (!configOpen) setConfigOpen(true);
  }, [chat, addLog, configOpen]);

  const handleNewConversation = useCallback(() => {
    if (selectedAgent) {
      chat.newConversation(selectedAgent.id);
      addLog("info", `New conversation with ${selectedAgent.name}`);
    }
  }, [chat, selectedAgent, addLog]);

  const handleConfigChange = useCallback((newConfig: ChatConfig) => {
    if (newConfig.provider !== config.provider || newConfig.model !== config.model) {
      addLog("info", `Config: ${newConfig.provider} · ${newConfig.model}`);
    }
    setConfig(newConfig);
  }, [config.provider, config.model, addLog]);

  const handleAbortStream = useCallback(() => {
    if (chat.isStreaming && selectedAgent) {
      addLog("warn", "⏹ Streaming cancelled by user");
    }
    chat.abortStream();
  }, [chat, selectedAgent, addLog]);

  useEffect(() => {
    if (chat.isStreaming && selectedAgent) {
      addLog("info", `↻ Streaming response from ${selectedAgent.name}...`);
    }
  }, [chat.isStreaming, selectedAgent?.name, addLog]);

  return (
    <div className="h-screen bg-zinc-950 py-12">
    {configOpen && (
      <div
        className="fixed inset-0 bg-black/50 z-10 md:hidden"
        onClick={() => setConfigOpen(false)}
      />
    )}
    <div className="relative flex h-full max-w-7xl mx-auto">
      {/* Left Column — Conversations + Agent Configuration */}
      <div
        className={`${
          configOpen ? "w-72" : "w-0"
        } shrink-0 transition-all duration-200 overflow-hidden
        absolute inset-y-0 left-0 z-20 md:relative md:inset-auto flex flex-col`}
      >
        {configOpen && (
          <>
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={chat.switchConversation}
              onNewConversation={handleNewConversation}
              onDelete={chat.deleteConversation}
            />
            <div className="flex-1 overflow-hidden">
              <AgentConfigPanel
                agents={agents}
                isLoading={isLoading}
                error={error}
                selectedAgent={selectedAgent}
                config={config}
                onChangeConfig={handleConfigChange}
                onChangeAgent={handleSelectAgent}
                onSave={handleSaveConfig}
              />
            </div>
          </>
        )}
      </div>

      {/* Toggle + Right Column */}
      <div className="flex flex-1 min-w-0">
        {/* Toggle button */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setConfigOpen((prev) => !prev); }}
          className="relative z-10 flex items-center justify-center w-10 md:w-8 shrink-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label={configOpen ? "Close config panel" : "Open config panel"}
        >
          <svg className={`h-4 w-4 transition-transform duration-200 ${configOpen ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Right Column — Chat + Logs */}
        <div className="flex flex-1 flex-col min-w-0 border border-zinc-800/80 rounded-xl my-2 mr-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <div>
            <h1 className="text-sm font-semibold text-zinc-200">Playground</h1>
            <p className="text-xs text-zinc-500">Test agents, prompts, and controls in a live chat UI.</p>
          </div>
          {selectedAgent && (
            <div className="flex items-center gap-3">
              {selectedAgent.icon && <span className="text-base">{selectedAgent.icon}</span>}
              <span className="text-sm font-medium text-zinc-300">{selectedAgent.name}</span>
              <span className="text-xs text-zinc-600">· {config.provider} · {config.model}</span>
              {chat.totalTokens > 0 && (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                  ~{chat.totalTokens} tok
                </span>
              )}
              {chat.messages.length > 0 && (
                <button
                  type="button"
                  onClick={chat.clearMessages}
                  className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
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
                    Start a conversation with {selectedAgent.icon && <span className="text-base">{selectedAgent.icon}</span>}<span className="text-zinc-300 font-medium">{selectedAgent.name}</span>.
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
            onStop={handleAbortStream}
            isStreaming={chat.isStreaming}
          />
        )}

        <Turnstile onToken={setTurnstileToken} />

        {/* Mobile agent selector */}
        {!selectedAgent && (
          <div className="block border-t border-zinc-800 p-4 md:hidden">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading agents...
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                Failed to load agents
              </div>
            ) : (
              <select
                value=""
                aria-label="Select an agent"
                onChange={(e) => {
                  const agent = agents.find((a) => a.id === e.target.value);
                  if (agent) handleSelectAgent(agent);
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="" disabled>Select an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.icon ?? ""} {agent.name} — {agent.role}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Logs */}
        <LiveLogs logs={logs} open={logsOpen} onToggle={() => setLogsOpen(!logsOpen)} />
      </div>
      </div>
    </div>
    </div>
  );
}
