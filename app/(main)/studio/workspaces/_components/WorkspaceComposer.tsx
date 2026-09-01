'use client'

import { agents } from '../../_data/agents'

interface Props {
  selected: string[]
  onToggle: (id: string) => void
  instruction: string
  onInstructionChange: (v: string) => void
  onStart: () => void
  running?: boolean
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'engineering', label: 'Engineering' },
  { key: 'validation', label: 'Validation' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'knowledge', label: 'Knowledge' },
]

export default function WorkspaceComposer({ selected, onToggle, instruction, onInstructionChange, onStart, running }: Props) {
  const visibleAgents = agents.filter((a) => a.id !== 'the-mediator')
  const canStart = selected.length > 0 && instruction.trim().length > 0 && !running

  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat, catIdx) => {
        const members = visibleAgents.filter((a) => a.category === cat.key)
        if (members.length === 0) return null
        return (
          <div key={cat.key} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${catIdx * 80}ms`, animationFillMode: 'both' } as React.CSSProperties}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{cat.label}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {members.map((agent) => {
                const isSelected = selected.includes(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onToggle(agent.id)}
                    className={`group cursor-pointer rounded-xl border p-4 text-left transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 active:scale-[0.98] will-change-transform ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20 scale-[1.01]'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/80 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[3deg]">{agent.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100 transition-colors group-hover:text-white">{agent.name}</div>
                        <div className="text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">{agent.role}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div
        className={`transition-all duration-300 ${
          selected.length > 0 ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
        }`}
      >
        <label className="mb-2 block text-sm font-medium text-zinc-200">Instruction</label>
        <textarea
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          placeholder="e.g. Suggest an area for improvement in https://github.com/fworks-tech/agenthood"
          rows={4}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:shadow-lg focus:shadow-indigo-500/10"
        />
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="mt-4 w-full cursor-pointer rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
        >
          {running ? 'Running...' : 'Start Workspace'}
        </button>
      </div>
    </div>
  )
}
