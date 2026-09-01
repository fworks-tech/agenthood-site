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

  const isRunning = workspace.workspaceState === 'running' || workspace.workspaceState === 'handoff'
  const hasStarted = workspace.workspaceId !== null

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    // Follow-ups must never wipe history — screenshots showed a second
    // "Give me a summary" replacing the whole thread because done/error
    // triggered start() which resets messages/workspaceId. Only the
    // initial composer (hasStarted===false) may start a new workspace;
    // otherwise always intervene so the conversation stays intact.
    if (!hasStarted) {
      await workspace.start({ memberIds: selected, instruction: text })
    } else {
      await workspace.sendIntervention(text)
    }
  }, [input, selected, workspace, hasStarted])

  const handleReset = useCallback(() => {
    workspace.reset()
    setSelected([])
    setInstruction('')
    setInput('')
  }, [workspace])

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold text-zinc-100">Workspaces</h1>
        <p className="text-sm text-zinc-500">Assemble a team, give one instruction, watch them collaborate. Mediator is auto-included.</p>
      </div>

      {!hasStarted ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 md:px-6">
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
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside className="hidden w-64 shrink-0 border-r border-zinc-800 p-4 md:block">
            <WorkspaceSidebar selected={selected} statusMap={workspace.statusMap} />
            {workspace.handoff && (
              <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm animate-in zoom-in-95 duration-300">
                <div className="font-medium text-amber-300">Human checkpoint</div>
                <div className="mt-1 text-xs text-amber-200/80">{workspace.handoff.reason}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={workspace.continueHandoff}
                    className="flex-1 cursor-pointer rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-all duration-200 hover:bg-amber-500 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Continue
                  </button>
                  <button
                    onClick={workspace.stop}
                    className="flex-1 cursor-pointer rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-600 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}
            {isRunning ? (
              <button
                onClick={workspace.stop}
                className="mt-4 w-full cursor-pointer rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-all duration-200 hover:bg-zinc-900 hover:border-zinc-700 hover:text-zinc-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                Stop workspace
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="mt-4 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-600 hover:text-white hover:scale-[1.01] active:scale-[0.99]"
              >
                New workspace
              </button>
            )}
          </aside>

          <div className="flex flex-1 min-h-0 flex-col min-w-0">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 md:hidden">
              <button onClick={() => setDrawerOpen(true)} className="cursor-pointer rounded border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-all duration-200 hover:bg-zinc-900 hover:border-zinc-700 hover:scale-[1.02] active:scale-95">
                Agents
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{workspace.workspaceState}</span>
                {isRunning ? (
                  <button onClick={workspace.stop} className="cursor-pointer rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition-all hover:bg-zinc-800">
                    Stop
                  </button>
                ) : (
                  <button onClick={handleReset} className="cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-all hover:bg-zinc-800">
                    New
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 md:px-6">
              <div className="mx-auto max-w-3xl">
                <WorkspaceChatArea messages={workspace.messages} statusMap={workspace.statusMap} />
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
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:shadow-lg focus:shadow-indigo-500/10"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  Send
                </button>
                {isRunning ? (
                  <button onClick={workspace.stop} className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-600 hover:text-zinc-200 hover:scale-[1.02] active:scale-95">
                    Stop
                  </button>
                ) : (
                  <button onClick={handleReset} className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-600 hover:text-zinc-200 hover:scale-[1.02] active:scale-95">
                    New workspace
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
          {isRunning ? (
            <button onClick={() => { workspace.stop(); setDrawerOpen(false) }} className="mt-4 w-full cursor-pointer rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-all hover:bg-zinc-900 hover:text-zinc-200">
              Stop workspace
            </button>
          ) : hasStarted ? (
            <button onClick={() => { handleReset(); setDrawerOpen(false) }} className="mt-4 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-800">
              New workspace
            </button>
          ) : null}
        </div>
      </MobileDrawer>
    </div>
  )
}
