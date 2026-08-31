'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAgentDirectory } from '../_hooks/useAgentDirectory';
import { useStudioChat } from '../_hooks/useStudioChat';
import { useCaptcha } from '../_hooks/useCaptcha';
import { useConversationExport } from '../_hooks/useConversationExport';
import { useToolReplay } from '../_hooks/useToolReplay';
import AgentConfigPanel from '../_components/AgentConfigPanel';
import ChatComposer from '../_components/ChatComposer';
import LiveLogs from '../_components/LiveLogs';
import ConversationList from '../_components/ConversationList';
import DragHandle from '../_components/DragHandle';
import MobileDrawer from '../_components/MobileDrawer';
import MobileBottomSheet from '../_components/MobileBottomSheet';
import HelpTip from '../_components/HelpTip';
import Turnstile from '../../../components/Turnstile';
import type { AgentEntry } from '../_data/agents';
import type { ChatConfig, Provider } from '../_types/studio';
import { getDefaultModel, getProviderMeta } from '../_types/studio';
import { agentSkills } from '../_data/agents.generated';
import { track } from '@vercel/analytics';
import PlaygroundHeader from './_components/PlaygroundHeader';
import PlaygroundSidebar from './_components/PlaygroundSidebar';
import PlaygroundChatArea from './_components/PlaygroundChatArea';
import MobileNavBar from './_components/MobileNavBar';
import { useLogs } from '../_hooks/useLogs';

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant.';

const CONFIG_STORAGE_KEY = 'agenthood-studio-config';

function loadSavedConfig(): Partial<ChatConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function PlaygroundPage() {
  const { agents, isLoading, error } = useAgentDirectory();
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);
  const [config, setConfig] = useState<ChatConfig>({
    provider: 'opencode-go',
    model: getDefaultModel('opencode-go'),
    baseUrl: getProviderMeta('opencode-go').defaultBaseUrl,
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  const [configOpen, setConfigOpen] = useState(true);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [leftColWidth, setLeftColWidth] = useState(288);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const {
    logs,
    addLog,
    handleNetworkLog,
    logsOpen,
    setLogsOpen,
    debugVisible,
    setDebugVisible,
    logCategoryFilter,
    setLogCategoryFilter,
    liveLogsHeight,
    setLiveLogsHeight,
  } = useLogs();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfigOpen(window.innerWidth >= 768);
  }, []);

  const chat = useStudioChat({ config, onLog: handleNetworkLog });
  const { conversations, activeConversationId, hydrated: chatHydrated } = chat;
  const captcha = useCaptcha({ addLog });
  const exportConv = useConversationExport({ conversations, activeConversationId, addLog });
  const toolReplay = useToolReplay({ chat, captcha, addLog });

  useEffect(() => {
    const saved = loadSavedConfig();
    if (saved.provider) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setConfig((prev) => ({ ...prev, ...saved }));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);
  const lastConfigConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeConversationId === lastConfigConvIdRef.current) return;
    lastConfigConvIdRef.current = activeConversationId;
    const saved = loadSavedConfig();
    if (saved.provider) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv?.config || Object.keys(conv.config).length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig((prev) => ({ ...prev, ...conv.config, apiKey: prev.apiKey }));
  }, [activeConversationId, conversations]);
  useEffect(() => {
    if (!isLoading && !error) {
      addLog('info', `Agents loaded: ${agents.length} available`);
      if (config.provider) {
        addLog('info', `Config: ${config.provider} · ${config.model}`);
      }
    }
  }, [isLoading, error, agents.length, addLog, config.model, config.provider]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedAgent) return;
      // Require a token for the send; the widget stays hidden after the first
      // verification but the fresh token is still sent so the first request
      // can establish the signed cookie (the cookie then covers all later
      // messages and prevents the consumed-token 400).
      if (captcha.isRequired && !captcha.tokenRef.current) {
        addLog('warn', 'CAPTCHA token not ready yet. Please wait a moment.', { category: 'captcha' });
        return;
      }
      const ts = Date.now();
      addLog('info', `→ ${selectedAgent.icon ?? ''} ${selectedAgent.name} · ${config.provider} · ${config.model}`);
      track('message_sent', {
        agentId: selectedAgent.id,
        provider: config.provider,
        model: config.model,
        conversationId: activeConversationId ?? undefined,
      });
      const captchaToken = captcha.tokenRef.current ?? undefined;
      try {
        await chat.sendMessage(content, captchaToken);
        const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
        addLog('info', `✓ ${selectedAgent.icon ?? ''} ${selectedAgent.name} completed in ${elapsed}s`);
        track('message_completed', {
          agentId: selectedAgent.id,
          provider: config.provider,
          model: config.model,
          durationMs: Date.now() - ts,
          tokenCount: chat.totalTokens,
        });
      } catch (err) {
        const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
        if (code === "CAPTCHA_FAILED") {
          addLog('warn', 'CAPTCHA token expired. Refreshing and retrying...', { category: 'captcha' });
          const ready = await captcha.refreshAndWait();
          if (ready) {
            try {
              await chat.retrySendMessage(content, captcha.tokenRef.current ?? undefined);
              const elapsed2 = ((Date.now() - ts) / 1000).toFixed(1);
              addLog('info', `✓ ${selectedAgent.icon ?? ''} ${selectedAgent.name} completed in ${elapsed2}s (retry)`);
              track('message_completed', {
                agentId: selectedAgent.id,
                provider: config.provider,
                model: config.model,
                durationMs: Date.now() - ts,
                tokenCount: chat.totalTokens,
              });
              return;
            } catch (retryErr) {
              const retryElapsed = ((Date.now() - ts) / 1000).toFixed(1);
              addLog(
                'error',
                `✗ ${selectedAgent.icon ?? ''} ${selectedAgent.name} failed after ${retryElapsed}s: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
              );
              track('message_error', {
                agentId: selectedAgent.id,
                provider: config.provider,
                error: retryErr instanceof Error ? retryErr.message : String(retryErr),
              });
              return;
            }
          }
          captcha.onError('CAPTCHA refresh timed out. Please verify manually.');
          const retryElapsed = ((Date.now() - ts) / 1000).toFixed(1);
          addLog(
            'error',
            `✗ ${selectedAgent.icon ?? ''} ${selectedAgent.name} failed after ${retryElapsed}s: ${err instanceof Error ? err.message : String(err)}`,
          );
          track('message_error', {
            agentId: selectedAgent.id,
            provider: config.provider,
            error: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
        addLog(
          'error',
          `✗ ${selectedAgent.icon ?? ''} ${selectedAgent.name} failed after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`,
        );
        track('message_error', {
          agentId: selectedAgent.id,
          provider: config.provider,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [chat, selectedAgent, config.provider, config.model, activeConversationId, addLog, captcha],
  );

  const handleSaveConfig = useCallback(
    (cfg: ChatConfig) => {
      try {
        sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ ...cfg, apiKey: undefined }));
        addLog('info', 'Configuration saved locally');
      } catch {
        addLog('error', 'Failed to save configuration');
      }
    },
    [addLog],
  );
  const handleSelectAgent = useCallback(
    (agent: AgentEntry) => {
      const provider: Provider = 'opencode-go';
      const model = getDefaultModel(provider);
      const prompt = agentSkills[agent.id] ?? DEFAULT_SYSTEM_PROMPT;
      setSelectedAgent(agent);
      const agentConfig = {
        provider,
        model,
        baseUrl: getProviderMeta(provider).defaultBaseUrl,
        systemPrompt: prompt,
      };
      setConfig((prev) => ({ ...prev, ...agentConfig }));
      chat.newConversation(agent.id, agentConfig);
      addLog('info', `Selected: ${agent.icon ?? ''} ${agent.name} · ${agent.role} · ${provider}/${model}`);
      track('agent_selected', { agentId: agent.id, provider, model });
      if (!configOpen && window.innerWidth >= 768) setConfigOpen(true);
    },
    [chat, addLog, configOpen],
  );
  const handleNewConversation = useCallback(() => {
    if (selectedAgent) {
      chat.newConversation(selectedAgent.id);
      addLog('info', `New conversation with ${selectedAgent.name}`);
      track('conversation_created', { agentId: selectedAgent.id });
    }
  }, [chat, selectedAgent, addLog]);
  const handleDeleteConversation = useCallback(
    (id: string) => {
      track('conversation_deleted', { agentId: selectedAgent?.id ?? 'unknown', conversationId: id });
      chat.deleteConversation(id);
    },
    [chat, selectedAgent?.id],
  );
  const handleConfigChange = useCallback(
    (newConfig: ChatConfig) => {
      if (newConfig.provider !== config.provider || newConfig.model !== config.model) {
        addLog('info', `Config: ${newConfig.provider} · ${newConfig.model}`);
        track('config_changed', {
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
      addLog('warn', '⏹ Streaming cancelled by user');
    }
    chat.abortStream();
  }, [chat, selectedAgent, addLog]);

  useEffect(() => {
    if (chat.isStreaming && selectedAgent) {
      addLog('info', `↻ Streaming response from ${selectedAgent.name}...`);
    }
  }, [chat.isStreaming, selectedAgent, addLog]);

  return (
    <div className="h-screen bg-zinc-950 py-12">
      <div className="relative flex h-full max-w-7xl mx-auto">
        <PlaygroundSidebar
          configOpen={configOpen}
          leftColWidth={leftColWidth}
          configPanelOpen={configPanelOpen}
          onToggleConfigPanel={() => setConfigPanelOpen((p) => !p)}
          chatHydrated={chatHydrated}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSwitchConversation={chat.switchConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          agents={agents}
          isLoading={isLoading}
          error={error}
          selectedAgent={selectedAgent}
          config={config}
          onChangeConfig={handleConfigChange}
          onChangeAgent={handleSelectAgent}
          onSave={handleSaveConfig}
          captchaToken={captcha.token}
        />
        {configOpen && (
          <DragHandle
            direction="horizontal"
            onDrag={(delta) => setLeftColWidth((w) => Math.min(500, Math.max(200, w + delta)))}
            className="hidden md:flex"
          />
        )}
        <div data-right-col className="flex flex-1 flex-col min-w-0 border border-zinc-800/80 rounded-xl mt-2 mb-16 mr-2 md:mb-2">
          <PlaygroundHeader
            selectedAgent={selectedAgent}
            config={config}
            totalTokens={chat.totalTokens}
            messagesLength={chat.messages.length}
            configOpen={configOpen}
            onToggleConfig={() => setConfigOpen((prev) => !prev)}
            onExport={exportConv.handleExport}
            onClear={chat.clearMessages}
          />
          <div className="flex-1 overflow-y-auto">
            <PlaygroundChatArea
              selectedAgent={selectedAgent}
              messages={chat.messages}
              isStreaming={chat.isStreaming}
              conversationId={chat.activeConversationId}
              onReplayTool={toolReplay.handleReplay}
              onSendMessage={handleSendMessage}
            />
          </div>
          {selectedAgent && (
            <ChatComposer
              onSend={handleSendMessage}
              onStop={handleAbortStream}
              isStreaming={chat.isStreaming}
              disabled={isLoading || !!error}
              captchaReady={!captcha.isRequired || !!captcha.token}
              captchaError={captcha.error}
              onRetryCaptcha={captcha.retry}
              captchaWidget={
                captcha.isRequired ? (
                  <Turnstile
                    onToken={captcha.setToken}
                    onError={captcha.onError}
                    onStatus={captcha.onStatus}
                    refreshKey={captcha.refreshKey}
                    visible={!captcha.verified}
                  />
                ) : undefined
              }
            />
          )}
          {!selectedAgent && (
            <div className="block border-t border-zinc-800 p-4 md:hidden">
              {isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                      {agent.icon ?? ''} {agent.name} — {agent.role}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <DragHandle
            direction="vertical"
            onDrag={(delta) => {
              const newH = Math.min(300, Math.max(40, liveLogsHeight - delta));
              setLiveLogsHeight(newH);
              if (!logsOpen) setLogsOpen(true);
            }}
          />
          <div style={{ height: logsOpen ? liveLogsHeight : undefined }} className="shrink-0">
            <LiveLogs
              logs={logs}
              open={logsOpen}
              onToggle={() => setLogsOpen(!logsOpen)}
              debugVisible={debugVisible}
              onToggleDebug={() => setDebugVisible((v) => !v)}
              categoryFilter={logCategoryFilter}
              onCategoryFilter={setLogCategoryFilter}
            />
          </div>
        </div>
      </div>
      <MobileNavBar
        onOpenConversations={() => setMobileDrawerOpen((p) => !p)}
        onOpenConfig={() => setMobileSheetOpen((p) => !p)}
        onToggleLogs={() => setLogsOpen((p) => !p)}
      />
      <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} onOpen={() => setMobileDrawerOpen(true)}>
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
      <MobileBottomSheet open={mobileSheetOpen} onClose={() => setMobileSheetOpen(false)}>
        <AgentConfigPanel
          agents={agents}
          isLoading={isLoading}
          error={error}
          selectedAgent={selectedAgent}
          config={config}
          onChangeConfig={handleConfigChange}
          onChangeAgent={handleSelectAgent}
          onSave={handleSaveConfig}
          captchaToken={captcha.token}
        />
      </MobileBottomSheet>
    </div>
  );
}
