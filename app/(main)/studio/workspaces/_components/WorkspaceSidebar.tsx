'use client'

import { getAgentById } from '../../_data/agents'
import type { WorkspaceStatus } from '../../_types/workspace'

interface Props {
  selected: string[]
  statusMap: Record<string, WorkspaceStatus>
}

const STATUS_DOT: Record<WorkspaceStatus, string> = {
  idle: 'bg-zinc-600',
  thinking: 'bg-yellow-400 animate-pulse',
  working: 'bg-indigo-500 animate-pulse',
  waiting: 'bg-orange-400',
  done: 'bg-emerald-500',
}

export default function WorkspaceSidebar({ selected, statusMap }: Props) {
  const all = ['the-mediator', ...selected]
  return (
    <div className="space-y-2">
      {all.map((id) => {
        const agent = getAgentById(id)
        const status: WorkspaceStatus = statusMap[id] ?? 'idle'
        return (
          <div key={id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 transition-all">
            <span className="text-base">{agent?.icon ?? '•'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-100">{agent?.name ?? id}</div>
              <div className="text-xs capitalize text-zinc-500">{status}</div>
            </div>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${STATUS_DOT[status]}`} />
          </div>
        )
      })}
    </div>
  )
}
