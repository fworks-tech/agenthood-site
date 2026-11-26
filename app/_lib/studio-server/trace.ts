import { pickSafeLogMeta } from './logger'
import { createTraceEnvelope, estimateCostFromTokens } from 'agenthood/dist/core'
import type { TraceSource } from 'agenthood/dist/core'

type LogLevel = 'info' | 'warn' | 'error'

export function emitLogEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {},
): void {
  controller.enqueue(
    new TextEncoder().encode(
      JSON.stringify({ type: 'log', level, event, ...pickSafeLogMeta(meta) }) + '\n',
    ),
  )
}

export interface TraceInput {
  member: string
  input: string
  output: string
  durationMs: number
  model: string
  correlationId: string
  source: TraceSource
  status: 'success' | 'error'
  inputChars: number
}

const TRACE_PAYLOAD_MAX = 8000

export function buildTraceEnvelope(input: TraceInput) {
  const inputTokens = Math.ceil(input.inputChars / 4)
  const outputTokens = Math.ceil(input.output.length / 4)
  return createTraceEnvelope({
    member: input.member,
    input: input.input.slice(0, TRACE_PAYLOAD_MAX),
    output: input.output.slice(0, TRACE_PAYLOAD_MAX),
    durationMs: input.durationMs,
    tokenCount: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost: estimateCostFromTokens(input.model, inputTokens, outputTokens),
    qualityScore: null,
    status: input.status,
    correlationId: input.correlationId,
    source: input.source,
    model: input.model,
  })
}

export interface WorkspaceTraceMeta {
  workspaceId: string
  turnIndex: number
  memberId: string
  correlationId: string
}

export function createWorkspaceTraceMeta(meta: WorkspaceTraceMeta): Record<string, unknown> {
  return {
    workspaceId: meta.workspaceId,
    turnIndex: meta.turnIndex,
    memberId: meta.memberId,
    correlationId: meta.correlationId,
  }
}
