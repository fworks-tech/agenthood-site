'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { getAgentById } from '../../_data/agents'
import type { WorkspaceToolCall } from '../../_hooks/useWorkspace'

interface Props {
  memberId: string
  content: string
  turnIndex: number
  toolCalls?: WorkspaceToolCall[]
}

function ToolBadge({ tc }: { tc: WorkspaceToolCall }) {
  const [open, setOpen] = useState(false)
  const statusColor =
    tc.status === 'complete' ? 'border-emerald-800/40 bg-emerald-950/20' : tc.status === 'error' ? 'border-red-800/40 bg-red-950/20' : 'border-zinc-700 bg-zinc-800/40'
  const dot =
    tc.status === 'complete' ? 'bg-emerald-400' : tc.status === 'error' ? 'bg-red-400' : 'bg-zinc-500 animate-pulse'
  return (
    <div className={`rounded border px-2 py-1.5 text-xs ${statusColor}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="font-medium text-zinc-200">{tc.name}</span>
        <span className="truncate text-zinc-500">{tc.args?.url ? String(tc.args.url).slice(0, 60) : tc.args?.code ? String(tc.args.code).slice(0, 40) : JSON.stringify(tc.args).slice(0, 60)}</span>
        <span className={`ml-auto shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">args</div>
            <pre className="mt-1 overflow-x-auto rounded bg-zinc-950/70 p-2 text-[11px] leading-relaxed">{JSON.stringify(tc.args, null, 2)}</pre>
          </div>
          {tc.result && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-emerald-400">result</div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-950/70 p-2 text-[11px] text-zinc-300">{tc.result.slice(0, 2000)}</pre>
            </div>
          )}
          {tc.error && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-red-400">error</div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-950/70 p-2 text-[11px] text-red-300">{tc.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function WorkspaceTurnCard({ memberId, content, turnIndex, toolCalls }: Props) {
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
        <span className="text-base">{agent?.icon ?? '•'}</span>
        <span className="text-sm font-semibold text-zinc-100">{agent?.name ?? memberId}</span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">turn {turnIndex}</span>
        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
      </div>
      {toolCalls && toolCalls.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {toolCalls.map((tc) => (
            <ToolBadge key={tc.id} tc={tc} />
          ))}
        </div>
      )}
      <div className="prose prose-invert max-w-none prose-sm prose-p:my-2 prose-pre:my-2 prose-pre:bg-zinc-950/70 prose-pre:text-xs">
        {content ? <ReactMarkdown>{content}</ReactMarkdown> : <span className="text-zinc-500">Thinking...</span>}
      </div>
    </div>
  )
}
