"use client";

import { useState, useCallback, useEffect } from "react";
import { useAgentDirectory } from "../_hooks/useAgentDirectory";
import { useStudioChat } from "../_hooks/useStudioChat";
import AgentConfigPanel from "../_components/AgentConfigPanel";
import MessageList from "../_components/MessageList";
import ChatComposer from "../_components/ChatComposer";
import LiveLogs from "../_components/LiveLogs";
import ConversationList from "../_components/ConversationList";
import DragHandle from "../_components/DragHandle";
import MobileDrawer from "../_components/MobileDrawer";
import MobileBottomSheet from "../_components/MobileBottomSheet";
import HelpTip from "../_components/HelpTip";
import Turnstile from "../../../components/Turnstile";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig, Provider } from "../_types/studio";
import { getDefaultModel } from "../_types/studio";
import { agentSkills } from "../_data/agents.generated";
import type { LogEntry } from "../_components/LiveLogs";
import { track } from "@vercel/analytics";
import { STORAGE_KEYS } from "../_lib/constants";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

function loadSavedConfig(): Partial<ChatConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.CONFIG);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function PlaygroundPage() {
  const { agents, isLoading, error } = useAgentDirectory();
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);
  const [config, setConfig] = useState<ChatConfig>({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [configOpen, setConfigOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(true);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [leftColWidth, setLeftColWidth] = useState(288);
  const [liveLogsHeight, setLiveLogsHeight] = useState(120);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfigOpen(window.innerWidth >= 768);
  }, []);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev.slice(-99), { time, level, message }]);
  }, []);

  const chat = useStudioChat({
    config,
    turnstileToken: turnstileToken ?? undefined,
  });
  const { conversations, activeConversationId, totalTokens, hydrated: chatHydrated } = chat;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadSavedConfig();
    if (saved.provider) {
      setConfig((prev) => ({ ...prev, ...saved }));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!isLoading && !error) {
      /* eslint-disable react-hooks/set-state-in-effect */
      addLog("info", `Agents loaded: ${agents.length} available`);
      if (config.provider) {
        addLog("info", `Config: ${config.provider} · ${config.model}`);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isLoading, error, agents.length, addLog, config.model, config.provider]);

  useEffect(() => {
    if (turnstileToken) {
      /* eslint-disable react-hooks/set-state-in-effect */
      addLog("info", "CAPTCHA ready");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [turnstileToken, addLog]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedAgent) return;
      if (!turnstileToken) {
        addLog("warn", "CAPTCHA token not ready yet. Please wait a moment.");
        return;
      }
      const ts = Date.now();
      addLog(
        "info",
        `→ ${selectedAgent.icon ?? ""} ${selectedAgent.name} · ${config.provider} · ${config.model}`,
      );
      track("message_sent", {
        agentId: selectedAgent.id,
        provider: config.provider,
        model: config.model,
        conversationId: activeConversationId ?? undefined,
      });
      try {
        await chat.sendMessage(content);
        const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
        addLog(
          "info",
          `✓ ${selectedAgent.icon ?? ""} ${selectedAgent.name} completed in ${elapsed}s`,
        );
        track("message_completed", {
          agentId: selectedAgent.id,
          provider: config.provider,
          model: config.model,
          durationMs: Date.now() - ts,
          tokenCount: totalTokens,
        });
      } catch (err) {
        const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
        addLog(
          "error",
          `✗ ${selectedAgent.icon ?? ""} ${selectedAgent.name} failed after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`,
        );
        track("message_error", {
          agentId: selectedAgent.id,
          provider: config.provider,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      chat,
      selectedAgent,
      config.provider,
      config.model,
      activeConversationId,
      totalTokens,
      addLog,
      turnstileToken,
    ],
  );

  const handleSaveConfig = useCallback(
    (cfg: ChatConfig) => {
      try {
        sessionStorage.setItem(
          STORAGE_KEYS.CONFIG,
          JSON.stringify({ ...cfg, apiKey: undefined }),
        );
        addLog("info", "Configuration saved locally");
      } catch {
        addLog("error", "Failed to save configuration");
      }
    },
    [addLog],
  );

  const handleSelectAgent = useCallback(
    (agent: AgentEntry) => {
      const provider = agent.preferredProvider as Provider;
      const model = getDefaultModel(provider);
      const prompt = agentSkills[agent.id] ?? DEFAULT_SYSTEM_PROMPT;
      setSelectedAgent(agent);
      setConfig((prev) => ({ ...prev, provider, model, systemPrompt: prompt }));
      chat.newConversation(agent.id);
      addLog(
        "info",
        `Selected: ${agent.icon ?? ""} ${agent.name} · ${agent.role} · ${provider}/${model}`,
      );
      track("agent_selected", { agentId: agent.id, provider, model });
      if (!configOpen) setConfigOpen(true);
    },
    [chat, addLog, configOpen],
  );

  const handleNewConversation = useCallback(() => {
    if (selectedAgent) {
      chat.newConversation(selectedAgent.id);
      addLog("info", `New conversation with ${selectedAgent.name}`);
      track("conversation_created", { agentId: selectedAgent.id });
    }
  }, [chat, selectedAgent, addLog]);

  const handleDeleteConversation = useCallback((id: string) => {
    track("conversation_deleted", {
      agentId: selectedAgent?.id ?? "unknown",
      conversationId: id,
    });
    chat.deleteConversation(id);
  }, [chat, selectedAgent?.id]);

  const handleConfigChange = useCallback(
    (newConfig: ChatConfig) => {
      if (
        newConfig.provider !== config.provider ||
        newConfig.model !== config.model
      ) {
        addLog("info", `Config: ${newConfig.provider} · ${newConfig.model}`);
        track("config_changed", {
          provider: newConfig.provider,
          model: newConfig.model,
          temperature: newConfig.temperature,
          maxTokens: newConfig.maxTokens,
        });
      }
      setConfig(newConfig);
    },
    [config.provider, config.model, addLog],
  );

  const handleAbortStream = useCallback(() => {
    if (chat.isStreaming && selectedAgent) {
      addLog("warn", "⏹ Streaming cancelled by user");
    }
    chat.abortStream();
  }, [chat, selectedAgent, addLog]);

  useEffect(() => {
    if (chat.isStreaming && selectedAgent) {
      /* eslint-disable react-hooks/set-state-in-effect */
      addLog("info", `↻ Streaming response from ${selectedAgent.name}...`);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [chat.isStreaming, selectedAgent, addLog]);

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
          style={{ width: configOpen ? leftColWidth : 0 }}
          className={`shrink-0 transition-all duration-200 overflow-hidden
        absolute inset-y-0 left-0 z-20 md:relative md:inset-auto flex flex-col`}
        >
          {configOpen && (
            <>
              <div
                style={{ flex: configPanelOpen ? "0 0 auto" : "1 1 0%" }}
                className="overflow-hidden flex flex-1 flex-col min-w-0 border border-zinc-800/80 rounded-xl my-2"
              >
                {chatHydrated && (
                  <div data-conversation-list="sidebar">
                    <ConversationList
                      conversations={conversations}
                      activeConversationId={activeConversationId}
                      onSelect={chat.switchConversation}
                      onNewConversation={handleNewConversation}
                      onDelete={handleDeleteConversation}
                    />
                  </div>
                )}
              </div>
              {/* DragHandle for config panel resize was removed — gesture conflicts with mobile drawer */}
              <div
                data-config-panel
                style={{
                  flex: configPanelOpen ? `1 1 auto` : "0 0 10px",
                }}
                className="overflow-auto"
              >
                <AgentConfigPanel
                  agents={agents}
                  isLoading={isLoading}
                  error={error}
                  selectedAgent={selectedAgent}
                  config={config}
                  onChangeConfig={handleConfigChange}
                  onChangeAgent={handleSelectAgent}
                  onSave={handleSaveConfig}
                  collapsed={!configPanelOpen}
                  onToggleCollapse={() => setConfigPanelOpen((p) => !p)}
                />
              </div>
            </>
          )}
        </div>

        {/* DragHandle for left column width */}
        {configOpen && (
          <DragHandle
            direction="horizontal"
            onDrag={(delta) =>
              setLeftColWidth((w) => Math.min(500, Math.max(200, w + delta)))
            }
          />
        )}

        {/* Right Column — Chat + Logs */}
        <div
          data-right-col
          className="flex flex-1 flex-col min-w-0 border border-zinc-800/80 rounded-xl my-2 mr-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-sm font-semibold text-zinc-200">
                  Playground
                </h1>
                <p className="text-xs text-zinc-500">
                  Test agents, prompts, and controls in a live chat UI.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setConfigOpen((prev) => !prev)}
                  className="rounded px-2 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors border border-zinc-800"
                  title={configOpen ? "Hide config panel" : "Show config panel"}
                  aria-label={
                    configOpen ? "Close config panel" : "Open config panel"
                  }
                >
                  {configOpen ? "← Hide Panel" : "→ Show Panel"}
                </button>
                <HelpTip
                  text="Toggles the left configuration sidebar with agent selection and conversation history."
                  side="right"
                />
              </div>
            </div>
            {selectedAgent && (
              <div className="flex items-center gap-3">
                {selectedAgent.icon && (
                  <span className="text-base">{selectedAgent.icon}</span>
                )}
                <span className="text-sm font-medium text-zinc-300">
                  {selectedAgent.name}
                </span>
                <span className="text-xs text-zinc-600">
                  · {config.provider} · {config.model}
                </span>
                {chat.totalTokens > 0 && (
                  <span className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                    ~{chat.totalTokens} tok
                    <HelpTip text="Approximate total tokens consumed in this conversation." />
                  </span>
                )}
                {chat.messages.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={chat.clearMessages}
                      className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      title="Clear conversation"
                    >
                      Clear
                    </button>
                    <HelpTip text="Removes all messages in the current conversation. This cannot be undone." />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto">
            {selectedAgent ? (
              chat.messages.length > 0 ? (
                <MessageList
                  messages={chat.messages}
                  isStreaming={chat.isStreaming}
                  conversationId={chat.activeConversationId ?? undefined}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-md text-center px-6">
                    <p className="flex items-center justify-center gap-1 text-sm text-zinc-500">
                      <span>
                        Start a conversation with{" "}
                        {selectedAgent.icon && (
                          <span className="text-base">
                            {selectedAgent.icon}
                          </span>
                        )}
                        <span className="text-zinc-300 font-medium">
                          {selectedAgent.name}
                        </span>
                        .
                      </span>
                      <HelpTip
                        text="Type a message below to begin. Prompts are validated and rate-limited server-side."
                        side="right"
                      />
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center px-6">
                  <h2 className="text-lg font-semibold text-zinc-300">
                    Welcome to Agenthood Studio
                  </h2>
                  <p className="mt-2 flex items-center justify-center gap-1 text-sm text-zinc-500">
                    Select a Society member from the left panel to start
                    testing.
                    <HelpTip
                      text="Choose an agent from the sidebar or pick one from the dropdown below."
                      side="bottom"
                    />
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
              disabled={isLoading || !!error}
            />
          )}

          <Turnstile onToken={setTurnstileToken} />

          {/* Mobile agent selector */}
          {!selectedAgent && (
            <div className="block border-t border-zinc-800 p-4 md:hidden">
              {isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading agents...
                  <HelpTip text="Fetching the agent directory from the server. This should take a moment." />
                </div>
              ) : error ? (
                <div className="flex items-center gap-1 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                  Failed to load agents
                  <HelpTip text="Could not load the agent list. Try again or check your connection." />
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
                  <option value="" disabled>
                    Select an agent...
                  </option>
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
          <DragHandle
            direction="vertical"
            onDrag={(delta) => {
              const newH = Math.min(300, Math.max(40, liveLogsHeight - delta));
              setLiveLogsHeight(newH);
              if (!logsOpen) setLogsOpen(true);
            }}
          />
          <div
            style={{ height: logsOpen ? liveLogsHeight : undefined }}
            className="shrink-0"
          >
            <LiveLogs
              logs={logs}
              open={logsOpen}
              onToggle={() => setLogsOpen(!logsOpen)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-around py-2">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((p) => !p)}
              className="flex flex-col items-center gap-1 px-4 py-1 text-zinc-400 hover:text-zinc-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
              <span className="text-[10px]">Conversations</span>
            </button>
            <HelpTip
              text="Opens the conversation history drawer to switch between or create new chats."
              side="top"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileSheetOpen((p) => !p)}
              className="flex flex-col items-center gap-1 px-4 py-1 text-zinc-400 hover:text-zinc-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-[10px]">Config</span>
            </button>
            <HelpTip
              text="Opens the agent configuration panel to change provider, model, temperature, and other settings."
              side="top"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setLogsOpen((p) => !p)}
              className="flex flex-col items-center gap-1 px-4 py-1 text-zinc-400 hover:text-zinc-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <span className="text-[10px]">Logs</span>
            </button>
            <HelpTip
              text="Toggles the live event log panel to view request routing and system messages."
              side="top"
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer for Conversations */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        onOpen={() => setMobileDrawerOpen(true)}
      >
        <div data-conversation-list="sidebar">
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={(id) => {
              chat.switchConversation(id);
              setMobileDrawerOpen(false);
            }}
            onNewConversation={handleNewConversation}
            onDelete={handleDeleteConversation}
          />
        </div>
      </MobileDrawer>

      {/* Mobile Bottom Sheet for Config */}
      <MobileBottomSheet
        open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
      >
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
      </MobileBottomSheet>
    </div>
  );
}
