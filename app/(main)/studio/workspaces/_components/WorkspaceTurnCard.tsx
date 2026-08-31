'use client'

import { getAgentById } from '../../_data/agents'

interface Props {
  memberId: string
  content: string
  turnIndex: number
}

export default function WorkspaceTurnCard({ memberId, content, turnIndex }: Props) {
  const agent = getAgentById(memberId)
  const isUser = memberId === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-indigo-600 px-4 py-3 text-sm text-white">{content}</div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span>{agent?.icon}</span>
        <span className="text-sm font-medium text-zinc-100">{agent?.name ?? memberId}</span>
        <span className="text-xs text-zinc-500">· turn {turnIndex}</span>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{content || 'Thinking...'}</div>
    </div>
  )
}
