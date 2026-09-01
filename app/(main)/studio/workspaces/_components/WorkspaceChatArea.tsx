'use client'

import AnimatedMessage from '../../playground/_components/AnimatedMessage'
import WorkspaceTurnCard from './WorkspaceTurnCard'
import type { WorkspaceMessage } from '../../_hooks/useWorkspace'
import type { WorkspaceStatus } from '../../_types/workspace'
import { getAgentById } from '../../_data/agents'

interface Props {
  messages: WorkspaceMessage[]
  statusMap?: Record<string, WorkspaceStatus>
}

export default function WorkspaceChatArea({ messages, statusMap }: Props) {
  // Collect members currently thinking/typing but without a fresh message yet
  const typingMembers = statusMap
    ? Object.entries(statusMap)
        .filter(([id, s]) => s === 'working' && id !== 'the-mediator')
        .map(([id]) => id)
        // don't show typing if their last message is already visible and still streaming
        .filter((id) => {
          const last = [...messages].reverse().find((m) => m.memberId === id)
          // if last message is very recent and still empty, the card itself shows Thinking
          if (!last) return true
          // if last message is thinkingOnly, card already shows indicator — still show global typing
          return true
        })
    : []

  if (messages.length === 0) {
    if (typingMembers.length > 0) {
      return (
        <div className="space-y-4">
          {typingMembers.map((id) => {
            const agent = getAgentById(id)
            return (
              <div key={`typing-${id}`} className="flex items-center gap-2 py-2 text-sm text-zinc-500">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '300ms' }} />
                </span>
                {agent?.name ?? id} is typing...
              </div>
            )
          })}
        </div>
      )
    }
    return (
      <div className="flex h-full items-center justify-center py-16 text-sm text-zinc-500">
        Workspace thread will appear here. Mediator will plan, then members will take turns.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <AnimatedMessage key={m.id}>
          <WorkspaceTurnCard memberId={m.memberId} content={m.content} turnIndex={m.turnIndex} toolCalls={m.toolCalls} />
        </AnimatedMessage>
      ))}
      {typingMembers.map((id) => {
        const lastMsg = [...messages].reverse().find((m) => m.memberId === id)
        // If last message from this member is still empty/thinking, the card already shows it — don't duplicate
        if (lastMsg && !lastMsg.content) return null
        const agent = getAgentById(id)
        return (
          <div key={`typing-${id}`} className="flex items-center gap-2 py-1 text-sm text-zinc-500">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '300ms' }} />
            </span>
            {agent?.name ?? id} is typing...
          </div>
        )
      })}
    </div>
  )
}
