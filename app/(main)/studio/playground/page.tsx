'use client';

import { useState, useEffect } from 'react';
import { useAgentDirectory } from '../_hooks/useAgentDirectory';
import { useStudioChat } from '../_hooks/useStudioChat';
import { useCaptcha } from '../_hooks/useCaptcha';
import { useConversationExport } from '../_hooks/useConversationExport';
import { useToolReplay } from '../_hooks/useToolReplay';
import { useSendMessage } from '../_hooks/useSendMessage';
import { usePlaygroundActions } from '../_hooks/usePlaygroundActions';
import AgentConfigPanel from '../_components/AgentConfigPanel';
import ChatComposer from '../_components/ChatComposer';
import LiveLogs from '../_components/LiveLogs';
import ConversationList from '../_components/ConversationList';
import DragHandle from '../_components/DragHandle';
import MobileDrawer from '../_components/MobileDrawer';
import MobileBottomSheet from '../_components/MobileBottomSheet';
import Turnstile from '../../../components/Turnstile';
import type { ChatConfig } from '../_types/studio';
import { getDefaultModel, getProviderMeta } from '../_types/studio';
import PlaygroundHeader from './_components/PlaygroundHeader';
import PlaygroundSidebar from './_components/PlaygroundSidebar';
import PlaygroundChatArea from './_components/PlaygroundChatArea';
import MobileAgentPicker from './_components/MobileAgentPicker';
import MobileNavBar from './_components/MobileNavBar';
import { useLogs } from '../_hooks/useLogs';
import { useActiveAgent } from '../_hooks/useActiveAgent';
import { useActiveConfigSync } from '../_hooks/useActiveConfigSync';

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
  const selectedAgent = useActiveAgent(conversations, activeConversationId, agents);
  const captcha = useCaptcha({ addLog });
  const exportConv = useConversationExport({ conversations, activeConversationId, addLog });
  const toolReplay = useToolReplay({ chat, captcha, addLog });
  const { handleSendMessage } = useSendMessage({ chat, selectedAgent, config, activeConversationId, captcha, addLog });
  const { handleSaveConfig, handleSelectAgent, handleNewConversation, handleDeleteConversation, handleConfigChange, handleAbortStream } =
    usePlaygroundActions({
      chat,
      selectedAgent,
      config,
      setConfig,
      configOpen,
      setConfigOpen,
      configStorageKey: CONFIG_STORAGE_KEY,
      defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      addLog,
    });

  useEffect(() => {
    const saved = loadSavedConfig();
    if (saved.provider) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setConfig((prev) => ({ ...prev, ...saved }));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);
  useActiveConfigSync(conversations, activeConversationId, setConfig);
  useEffect(() => {
    if (!isLoading && !error) {
      addLog('info', `Agents loaded: ${agents.length} available`);
      if (config.provider) {
        addLog('info', `Config: ${config.provider} · ${config.model}`);
      }
    }
  }, [isLoading, error, agents.length, addLog, config.model, config.provider]);


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
            <MobileAgentPicker agents={agents} isLoading={isLoading} error={error} onSelect={handleSelectAgent} />
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
