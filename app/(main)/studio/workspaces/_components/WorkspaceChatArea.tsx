'use client'

import AnimatedMessage from '../../playground/_components/AnimatedMessage'
import WorkspaceTurnCard from './WorkspaceTurnCard'
import type { WorkspaceMessage } from '../../_hooks/useWorkspace'

interface Props {
  messages: WorkspaceMessage[]
}

export default function WorkspaceChatArea({ messages }: Props) {
  if (messages.length === 0) {
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
    </div>
  )
}
