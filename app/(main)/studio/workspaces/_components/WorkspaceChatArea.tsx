'use client'

import { useState } from 'react'
import AnimatedMessage from '../../playground/_components/AnimatedMessage'
import WorkspaceTurnCard from './WorkspaceTurnCard'
import type { WorkspaceMessage } from '../../_hooks/useWorkspace'
import type { WorkspaceStatus } from '../../_types/workspace'
import { getAgentById } from '../../_data/agents'
import { isUsefulPolished, toPolished } from '../../_lib/workspace-polish'

interface Props {
  messages: WorkspaceMessage[]
  statusMap?: Record<string, WorkspaceStatus>
}

export default function WorkspaceChatArea({ messages, statusMap }: Props) {
  const [showHidden, setShowHidden] = useState(false)
  // Collect members currently thinking/typing but without a fresh message yet
  // Include the-mediator here — while it has no card (empty/routing plan
  // is hidden) the typing dots are the only feedback during the first
  // turn; excluding it made a fresh workspace look empty.
  const typingMembers = statusMap
    ? Object.entries(statusMap)
        .filter(([, s]) => s === 'working')
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
  // Collapse intermediate non-useful turns when the thread gets long — screenshots
  // showed 15+ huge cards stacked, making the final answer hard to find.
  // Keep: every user bubble + every useful polished answer + the latest
  // streaming placeholder. Hide older thinking/working intermediaries behind
  // a toggle.
  const THRESHOLD = 6
  let visibleMessages = messages
  let hiddenMessages: WorkspaceMessage[] = []
  if (messages.length > THRESHOLD) {
    const lastIdx = messages.length - 1
    const keep = new Set<number>()
    messages.forEach((m, i) => {
      if (m.memberId === 'user') keep.add(i)
      else if (m.content === '') keep.add(i)
      else if (isUsefulPolished(toPolished(m.content))) keep.add(i)
      else if (i === lastIdx) keep.add(i) // keep latest intermediate for context
    })
    // always keep first and last 2 to avoid empty collapse edge cases
    keep.add(0)
    keep.add(lastIdx)
    if (lastIdx - 1 >= 0) keep.add(lastIdx - 1)
    visibleMessages = messages.filter((_, i) => keep.has(i))
    hiddenMessages = messages.filter((_, i) => !keep.has(i))
    if (hiddenMessages.length === 0) visibleMessages = messages
  }

  return (
    <div className="space-y-4">
      {hiddenMessages.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className="w-full cursor-pointer rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400 transition-all duration-200 hover:bg-zinc-900 hover:text-zinc-200 hover:border-zinc-500 hover:scale-[1.01] active:scale-[0.99]"
        >
          {showHidden ? 'Hide intermediate updates' : `Show ${hiddenMessages.length} intermediate updates`}
        </button>
      )}
      {(showHidden ? messages : visibleMessages).map((m) => (
        <AnimatedMessage key={m.id}>
          <WorkspaceTurnCard memberId={m.memberId} content={m.content} turnIndex={m.turnIndex} toolCalls={m.toolCalls} />
        </AnimatedMessage>
      ))}
      {/* when collapsed, also render hidden as collapsed details if user expanded */}
      {typingMembers.map((id) => {
        const lastMsg = [...messages].reverse().find((m) => m.memberId === id)
        // If last message from this member is still empty, the card already
        // shows "is thinking..." — don't duplicate, except for the-mediator
        // whose empty/bare-JSON card is hidden (return null in the card).
        if (lastMsg && !lastMsg.content && id !== 'the-mediator') return null
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
