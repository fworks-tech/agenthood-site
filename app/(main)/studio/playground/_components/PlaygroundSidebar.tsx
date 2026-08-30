'use client';

import ConversationList from '../../_components/ConversationList';
import AgentConfigPanel from '../../_components/AgentConfigPanel';
import type { AgentEntry } from '../../_data/agents';
import type { ChatConfig } from '../../_types/studio';
import type { Conversation } from '../../_hooks/useStudioChat';

interface PlaygroundSidebarProps {
  configOpen: boolean;
  leftColWidth: number;
  configPanelOpen: boolean;
  onToggleConfigPanel: () => void;
  chatHydrated: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSwitchConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  agents: AgentEntry[];
  isLoading: boolean;
  error: string | null;
  selectedAgent: AgentEntry | null;
  config: ChatConfig;
  onChangeConfig: (cfg: ChatConfig) => void;
  onChangeAgent: (agent: AgentEntry) => void;
  onSave: (cfg: ChatConfig) => void;
  captchaToken: string | null;
}

export default function PlaygroundSidebar({
  configOpen,
  leftColWidth,
  configPanelOpen,
  onToggleConfigPanel,
  chatHydrated,
  conversations,
  activeConversationId,
  onSwitchConversation,
  onNewConversation,
  onDeleteConversation,
  agents,
  isLoading,
  error,
  selectedAgent,
  config,
  onChangeConfig,
  onChangeAgent,
  onSave,
  captchaToken,
}: PlaygroundSidebarProps) {
  if (!configOpen) return null;
  return (
    <div
      style={{ width: leftColWidth }}
      className="hidden shrink-0 transition-all duration-200 overflow-hidden flex-col md:relative md:flex"
    >
      <div
        style={{ flex: configPanelOpen ? '0 0 auto' : '1 1 0%' }}
        className="overflow-hidden flex flex-1 flex-col min-w-0 border border-zinc-800/80 rounded-xl my-2"
      >
        {chatHydrated && (
          <div data-conversation-list="sidebar">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={onSwitchConversation}
              onNewConversation={onNewConversation}
              onDelete={onDeleteConversation}
            />
          </div>
        )}
      </div>
      <div
        data-config-panel
        style={{ flex: configPanelOpen ? '1 1 auto' : '0 0 10px' }}
        className="overflow-auto"
      >
        <AgentConfigPanel
          agents={agents}
          isLoading={isLoading}
          error={error}
          selectedAgent={selectedAgent}
          config={config}
          onChangeConfig={onChangeConfig}
          onChangeAgent={onChangeAgent}
          onSave={onSave}
          collapsed={!configPanelOpen}
          onToggleCollapse={onToggleConfigPanel}
          captchaToken={captchaToken}
        />
      </div>
    </div>
  );
}
