'use client'

import { useState, useCallback } from 'react'
import { useWorkspace } from '../_hooks/useWorkspace'
import { useLogs } from '../_hooks/useLogs'
import WorkspaceComposer from './_components/WorkspaceComposer'
import WorkspaceSidebar from './_components/WorkspaceSidebar'
import WorkspaceChatArea from './_components/WorkspaceChatArea'
import LiveLogs from '../_components/LiveLogs'
import MobileDrawer from '../_components/MobileDrawer'

export default function WorkspacesPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [instruction, setInstruction] = useState('')
  const [input, setInput] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const workspace = useWorkspace()
  const { logs, logsOpen, setLogsOpen, debugVisible, setDebugVisible, logCategoryFilter, setLogCategoryFilter, liveLogsHeight } = useLogs()

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const handleStart = useCallback(async () => {
    if (selected.length === 0 || !instruction.trim()) return
    await workspace.start({ memberIds: selected, instruction: instruction.trim() })
  }, [selected, instruction, workspace])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (workspace.workspaceState === 'idle' || workspace.workspaceState === 'done' || workspace.workspaceState === 'error') {
      await workspace.start({ memberIds: selected, instruction: text })
    } else {
      await workspace.sendIntervention(text)
    }
  }, [input, selected, workspace])

  const isRunning = workspace.workspaceState === 'running' || workspace.workspaceState === 'handoff'
  const hasStarted = workspace.workspaceId !== null

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold text-zinc-100">Workspaces</h1>
        <p className="text-sm text-zinc-500">Assemble a team, give one instruction, watch them collaborate. Mediator is auto-included.</p>
      </div>

      {!hasStarted ? (
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
          <div className="mx-auto max-w-4xl">
            <WorkspaceComposer
              selected={selected}
              onToggle={toggle}
              instruction={instruction}
              onInstructionChange={setInstruction}
              onStart={handleStart}
              running={isRunning}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden w-64 shrink-0 border-r border-zinc-800 p-4 md:block">
            <WorkspaceSidebar selected={selected} statusMap={workspace.statusMap} />
            {workspace.handoff && (
              <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm">
                <div className="font-medium text-amber-300">Human checkpoint</div>
                <div className="mt-1 text-xs text-amber-200/80">{workspace.handoff.reason}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={workspace.continueHandoff}
                    className="flex-1 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                  >
                    Continue
                  </button>
                  <button
                    onClick={workspace.stop}
                    className="flex-1 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={workspace.stop}
              className="mt-4 w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
            >
              Stop workspace
            </button>
          </aside>

          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 md:hidden">
              <button onClick={() => setDrawerOpen(true)} className="rounded border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
                Agents
              </button>
              <span className="text-xs text-zinc-500">{workspace.workspaceState}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
              <div className="mx-auto max-w-3xl">
                <WorkspaceChatArea messages={workspace.messages} />
                {workspace.error && (
                  <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">{workspace.error}</div>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-800 p-4">
              <div className="mx-auto flex max-w-3xl gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={isRunning ? 'Send a message to intervene...' : 'Send a follow-up instruction...'}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Send
                </button>
                {isRunning && (
                  <button onClick={workspace.stop} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400">
                    Stop
                  </button>
                )}
              </div>
            </div>

            <div style={{ height: logsOpen ? liveLogsHeight : undefined }} className="shrink-0">
              <LiveLogs
                logs={logs}
                open={logsOpen}
                onToggle={() => setLogsOpen(!logsOpen)}
                debugVisible={debugVisible}
                onToggleDebug={() => setDebugVisible((v) => !v)}
                categoryFilter={logCategoryFilter}
                onCategoryFilter={setLogCategoryFilter}
              />
            </div>
          </div>
        </div>
      )}

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpen={() => setDrawerOpen(true)}>
        <div className="p-4">
          <WorkspaceSidebar selected={selected} statusMap={workspace.statusMap} />
        </div>
      </MobileDrawer>
    </div>
  )
}
