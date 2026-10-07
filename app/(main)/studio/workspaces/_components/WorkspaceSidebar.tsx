'use client'

import { getAgentById } from '../../_data/agents'
import type { WorkspaceStatus } from '../../_types/workspace'

interface Props {
  selected: string[]
  statusMap: Record<string, WorkspaceStatus>
  handoff?: { memberId: string; reason: string } | null
  onContinue?: () => void
  onStop?: () => void
  notifyEnabled?: boolean
  onNotifyChange?: (on: boolean) => void
}

const STATUS_DOT: Record<WorkspaceStatus, string> = {
  idle: 'bg-zinc-400 dark:bg-zinc-600',
  thinking: 'bg-yellow-400 animate-pulse',
  working: 'bg-indigo-500 animate-pulse',
  waiting: 'bg-orange-400',
  done: 'bg-emerald-500',
}

export default function WorkspaceSidebar({ selected, statusMap, handoff, onContinue, onStop, notifyEnabled, onNotifyChange }: Props) {
  const all = ['the-mediator', ...selected]
  return (
    <div className="space-y-2">
      {all.map((id, idx) => {
        const agent = getAgentById(id)
        const status: WorkspaceStatus = statusMap[id] ?? 'idle'
        return (
          <div
            key={id}
            className="group flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3 py-2.5 transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 hover:translate-x-[2px] hover:shadow-md animate-in fade-in slide-in-from-left-2"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' } as React.CSSProperties}
          >
            <span className="text-base transition-transform duration-300 group-hover:scale-110">{agent?.icon ?? '•'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-black dark:group-hover:text-white">{agent?.name ?? id}</div>
              <div className="text-xs capitalize text-zinc-500 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-400">{status}</div>
            </div>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300 ${STATUS_DOT[status]} group-hover:scale-125`} />
          </div>
        )
      })}
      {handoff && (
        <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm animate-in zoom-in-95 duration-300">
          <div className="font-medium text-amber-300">Human checkpoint</div>
          <div className="mt-1 text-xs text-amber-200/80">{handoff.reason}</div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 cursor-pointer rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-all duration-200 hover:bg-amber-500 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onStop}
              className="flex-1 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 transition-all duration-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            >
              Stop
            </button>
          </div>
        </div>
      )}
      {onNotifyChange && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={notifyEnabled ?? false}
            onChange={(e) => onNotifyChange(e.currentTarget.checked)}
            aria-label="Browser notifications"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          />
          Notify me when input is needed
        </label>
      )}
    </div>
  )
}
