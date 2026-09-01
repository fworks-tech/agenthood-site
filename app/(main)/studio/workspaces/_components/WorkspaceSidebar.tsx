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
      {all.map((id, idx) => {
        const agent = getAgentById(id)
        const status: WorkspaceStatus = statusMap[id] ?? 'idle'
        return (
          <div
            key={id}
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-800/70 hover:translate-x-[2px] hover:shadow-md animate-in fade-in slide-in-from-left-2"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' } as React.CSSProperties}
          >
            <span className="text-base transition-transform duration-300 group-hover:scale-110">{agent?.icon ?? '•'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-100 transition-colors group-hover:text-white">{agent?.name ?? id}</div>
              <div className="text-xs capitalize text-zinc-500 transition-colors group-hover:text-zinc-400">{status}</div>
            </div>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300 ${STATUS_DOT[status]} group-hover:scale-125`} />
          </div>
        )
      })}
    </div>
  )
}
