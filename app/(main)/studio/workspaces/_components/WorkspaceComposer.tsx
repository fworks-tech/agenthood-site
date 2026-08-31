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
      {CATEGORIES.map((cat) => {
        const members = visibleAgents.filter((a) => a.category === cat.key)
        if (members.length === 0) return null
        return (
          <div key={cat.key}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{cat.label}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {members.map((agent) => {
                const isSelected = selected.includes(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onToggle(agent.id)}
                    className={`rounded-lg border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{agent.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100">{agent.name}</div>
                        <div className="text-xs text-zinc-400">{agent.role}</div>
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
          placeholder="e.g. Suggest an area for improvement for https://github.com/fworks-tech/agenthood"
          rows={4}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Running...' : 'Start Workspace'}
        </button>
      </div>
    </div>
  )
}
