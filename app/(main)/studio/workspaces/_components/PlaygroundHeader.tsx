// #TODO Workspaces: replace with workspace header (selected members + Mediator status) per spec.md:192-198
'use client';

import { Menu } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import HelpTip from '../../_components/HelpTip';
import type { AgentEntry } from '../../_data/agents';
import type { ChatConfig } from '../../_types/studio';

interface PlaygroundHeaderProps {
  selectedAgent: AgentEntry | null;
  config: ChatConfig;
  totalTokens: number;
  messagesLength: number;
  configOpen: boolean;
  onToggleConfig: () => void;
  onExport: (format: 'json' | 'md') => void;
  onClear: () => void;
}

export default function PlaygroundHeader({
  selectedAgent,
  config,
  totalTokens,
  messagesLength,
  configOpen,
  onToggleConfig,
  onExport,
  onClear,
}: PlaygroundHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-zinc-800 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <div>
          <h1 className="text-sm font-semibold text-zinc-200">Playground</h1>
          <p className="text-xs text-zinc-500">Test agents, prompts, and controls in a live chat UI.</p>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleConfig}
            className="rounded px-2 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors border border-zinc-800"
            title={configOpen ? 'Hide config panel' : 'Show config panel'}
            aria-label={configOpen ? 'Close config panel' : 'Open config panel'}
          >
            {configOpen ? '← Hide Panel' : '→ Show Panel'}
          </button>
          <HelpTip
            text="Toggles the left configuration sidebar with agent selection and conversation history."
            side="right"
          />
        </div>
      </div>
      {selectedAgent && (
        <div key={selectedAgent.id} className="flex min-w-0 items-center gap-3 animate-[slide-up_0.2s_ease-out_forwards]">
          {selectedAgent.icon && <span className="shrink-0 text-base">{selectedAgent.icon}</span>}
          <span className="truncate text-sm font-medium text-zinc-300">{selectedAgent.name}</span>
          <span className="hidden truncate text-xs text-zinc-600 sm:inline">
            · {config.provider} · {config.model}
          </span>
          {totalTokens > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
              ~{totalTokens} tok
              <HelpTip text="Approximate total tokens consumed in this conversation." />
            </span>
          )}
          {messagesLength > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              <Menu shadow="md" width={200} position="bottom-end" withinPortal>
                <Menu.Target>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Export conversation"
                    aria-label="Export conversation"
                  >
                    <IconDownload size={14} />
                    Export
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => onExport('json')}>Export JSON</Menu.Item>
                  <Menu.Item onClick={() => onExport('md')}>Export Markdown</Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <button
                type="button"
                onClick={onClear}
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
  );
}
