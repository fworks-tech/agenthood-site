"use client";

import { useState } from "react";
import StudioShell from "./_components/StudioShell";
import ChatArea from "./_components/ChatArea";
import { useAgentDirectory } from "./_hooks/useAgentDirectory";
import type { AgentEntry } from "./_data/agents";

export default function StudioPage() {
  const { agents, isLoading } = useAgentDirectory();
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);

  return (
    <StudioShell
      agents={agents}
      selectedAgent={selectedAgent}
      onSelectAgent={setSelectedAgent}
      isLoading={isLoading}
    >
      {selectedAgent ? (
        <ChatArea agent={selectedAgent} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="text-4xl mb-4">⚡</div>
            <h2 className="text-lg font-semibold text-zinc-300">Welcome to Agenthood Studio</h2>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              Select a Society member from the sidebar to start a conversation.
              Each member has a specialized role — from code review to security auditing.
            </p>
            {!isLoading && agents.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {agents.slice(0, 6).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </StudioShell>
  );
}
