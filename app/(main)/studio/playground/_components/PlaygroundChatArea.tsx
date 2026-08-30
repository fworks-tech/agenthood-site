'use client';

import MessageList from '../../_components/MessageList';
import WelcomeTerminal from './WelcomeTerminal';
import type { AgentEntry } from '../../_data/agents';
import type { ChatMessage } from '../../_lib/studio-api';
import { agentPrompts } from '../../_data/agentPrompts.generated';

interface PlaygroundChatAreaProps {
  selectedAgent: AgentEntry | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  conversationId: string | null;
  onReplayTool: (messageId: string, toolCallId: string) => void;
  onSendMessage: (content: string) => void;
}

export default function PlaygroundChatArea({
  selectedAgent,
  messages,
  isStreaming,
  conversationId,
  onReplayTool,
  onSendMessage,
}: PlaygroundChatAreaProps) {
  if (!selectedAgent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-lg text-center px-6">
          <h2 className="text-lg font-semibold text-zinc-300">Welcome to Agenthood Studio</h2>
          <p className="mt-2 text-sm text-zinc-500 mb-8">
            Select a Society member from the left panel to start testing.
          </p>
          <WelcomeTerminal />
        </div>
      </div>
    );
  }

  if (messages.length > 0) {
    return (
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        conversationId={conversationId ?? undefined}
        onReplayTool={onReplayTool}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center px-6">
        <span className="text-4xl">{selectedAgent.icon}</span>
        <h2 className="mt-3 text-lg font-semibold text-zinc-200">{selectedAgent.name}</h2>
        <p className="mt-1 text-sm text-zinc-500">{selectedAgent.role}</p>
        <div className="mt-6 space-y-2">
          {(agentPrompts[selectedAgent.id] ?? []).slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSendMessage(prompt)}
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-left text-sm text-zinc-400 hover:border-emerald-800 hover:text-zinc-200 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
