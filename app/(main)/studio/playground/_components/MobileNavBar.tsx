'use client';

import HelpTip from '../../_components/HelpTip';

interface MobileNavBarProps {
  onOpenConversations: () => void;
  onOpenConfig: () => void;
  onToggleLogs: () => void;
}

export default function MobileNavBar({ onOpenConversations, onOpenConfig, onToggleLogs }: MobileNavBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-around py-2">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onOpenConversations}
            className="flex flex-col items-center gap-1 px-4 py-1 text-zinc-400 hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <span className="text-[10px]">Conversations</span>
          </button>
          <HelpTip text="Opens the conversation history drawer to switch between or create new chats." side="top" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onOpenConfig}
            className="flex flex-col items-center gap-1 px-4 py-1 text-zinc-400 hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
            onClick={onToggleLogs}
            className="flex flex-col items-center gap-1 px-4 py-1 text-zinc-400 hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-[10px]">Logs</span>
          </button>
          <HelpTip text="Toggles the live event log panel to view request routing and system messages." side="top" />
        </div>
      </div>
    </div>
  );
}
