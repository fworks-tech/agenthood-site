// #TODO Workspaces: client state machine per docs/hackathon/spec.md:198,254-266
// - client-driven turn loop (maxDuration 60 per turn, one POST per member turn)
// - handles workspace.started/turn_start/token/tool_call/tool_result/turn_end/status/handoff/done/error
// - user intervention: AbortSignal current turn + Mediator re-evaluates immediately
// - do NOT duplicate readSSEStream block (see _hooks/useStudioChat.ts:305-362 vs 462-519) — extract shared runner
'use client'

export function useWorkspace() {
  // #TODO implement
  return null as unknown as never
}
