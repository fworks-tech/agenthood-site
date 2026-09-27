import { buildSystemPrompt } from './system-prompt'
import { getToolSchemas, PLAYGROUND_MAX_TOOL_ITERATIONS } from './tools'
import { logger } from './logger'
import { emitLogEvent, buildTraceEnvelope, createWorkspaceTraceMeta } from './trace'
import { selectDemoModel, getMemberTools, DEMO_MAX_TOKENS } from '../_types/studio'
import { buildMemberMessages, shouldRequestHandoff, type ThreadMessage } from './workspace-orchestrator'
import { buildDemoLLMConfig } from './agenthood-adapter'
import { runToolLoop, withProviderRetry } from './tool-loop'
import type { Message } from 'agenthood/dist/llm'

export interface WorkspaceTurnRequest {
  workspaceId: string
  correlationId: string
  memberId: string
  instruction: string
  thread: ThreadMessage[]
  turnIndex: number
}

function encode(controller: ReadableStreamDefaultController<Uint8Array>, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(payload) + '\n'))
}

// Stream tokens in small batches — per-char enqueues caused ~10k controller
// writes and client state updates per turn on long answers.
const TOKEN_CHUNK = 128

export async function createWorkspaceTurnStream(
  req: WorkspaceTurnRequest,
  signal?: AbortSignal,
): Promise<ReadableStream> {
  const systemPrompt = buildSystemPrompt(req.memberId)
  if (!systemPrompt) throw new Error(`No system prompt for agent "${req.memberId}"`)

  // Capability follows identity: prose-lane members get web_fetch only, the
  // code_execution sandbox is reserved for the code lane.
  const enabledTools = getMemberTools(req.memberId)
  const allSchemas = getToolSchemas()
  const toolSchemas = allSchemas.filter((s) => enabledTools.includes(s.name))

  const startTime = performance.now()
  const workspaceMeta = createWorkspaceTraceMeta({
    workspaceId: req.workspaceId,
    turnIndex: req.turnIndex,
    memberId: req.memberId,
    correlationId: req.correlationId,
  })

  const threadWithInstruction: ThreadMessage[] =
    req.thread.length === 0
      ? [{ role: 'user', content: req.instruction }]
      : req.thread

  // Workspace turns always carry tools, so the Q&A tier never applies here —
  // code members and code-bearing threads get the code tier, rest default.
  const model = selectDemoModel(req.memberId, threadWithInstruction, true)

  const messages = buildMemberMessages(systemPrompt, threadWithInstruction)

  return new ReadableStream({
    async start(controller) {
      let output = ''
      let outputChars = 0

      const wsLog = (level: 'info' | 'warn' | 'error', event: string, extra: Record<string, unknown> = {}) => {
        emitLogEvent(controller, level, event, { ...workspaceMeta, ...extra })
      }

      const emitTrace = (status: 'success' | 'error') => {
        const envelope = buildTraceEnvelope({
          member: req.memberId,
          input: threadWithInstruction.map((m) => m.content).join('\n'),
          output,
          durationMs: Math.round(performance.now() - startTime),
          model,
          correlationId: req.correlationId,
          source: 'api',
          status,
          inputChars: threadWithInstruction.reduce((n, m) => n + m.content.length, 0) + systemPrompt.length,
        })
        logger.info('trace', { ...envelope })
        emitLogEvent(controller, 'info', 'trace', { ...envelope, ...workspaceMeta } as unknown as Record<string, unknown>)
      }

      wsLog('info', 'workspace.turn_start', { memberId: req.memberId, turnIndex: req.turnIndex })

      encode(controller, {
        type: 'workspace.turn_start',
        memberId: req.memberId,
        role: req.memberId,
        turnIndex: req.turnIndex,
        workspaceId: req.workspaceId,
        correlationId: req.correlationId,
      })
      encode(controller, {
        type: 'workspace.status',
        memberId: req.memberId,
        status: 'working',
        workspaceId: req.workspaceId,
        correlationId: req.correlationId,
      })

      try {
        const { LLMRouter } = await import('agenthood/dist/llm')
        const llmConfig = buildDemoLLMConfig()
        const provider = await LLMRouter.fromConfig(llmConfig)
        try {
          provider.setModel(model)
        } catch {}

        const llmMessages: Message[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id, name: m.name } : {}),
        }))

        let handoffEmitted = false
        const handoffPayload = {
          type: 'workspace.handoff',
          memberId: req.memberId,
          reason: 'code_execution requested — awaiting human approval',
          options: ['continue', 'stop'],
          workspaceId: req.workspaceId,
          correlationId: req.correlationId,
        }

        // Same 60s Hobby budget as the playground: short loop, capped output,
        // one 5xx retry — a 25-iteration turn cannot fit the budget. The loop
        // itself is shared with the playground so the cap, the retry and the role
        // allowlist cannot drift apart again.
        const loop = await runToolLoop({
          provider,
          messages: llmMessages,
          toolSchemas,
          maxIterations: PLAYGROUND_MAX_TOOL_ITERATIONS,
          signal,
          onToolCall: (tc) => {
            // Live collaboration: keep iterating even after a handoff is emitted
            // (the UI surfaces the checkpoint but does not block the agent from
            // continuing to reason and produce a useful answer).
            if (!handoffEmitted && shouldRequestHandoff(tc.name)) {
              handoffEmitted = true
              encode(controller, handoffPayload)
              wsLog('info', 'workspace.handoff', { memberId: req.memberId, reason: handoffPayload.reason })
            }
            encode(controller, {
              type: 'workspace.tool_call',
              memberId: req.memberId,
              id: tc.id,
              name: tc.name,
              args: tc.args,
              workspaceId: req.workspaceId,
              correlationId: req.correlationId,
            })
            wsLog('info', 'workspace.tool_call', { memberId: req.memberId, tool: tc.name })
          },
          onToolResult: (tc, outcome) => {
            encode(controller, {
              type: 'workspace.tool_result',
              memberId: req.memberId,
              id: tc.id,
              name: tc.name,
              result: outcome.result ?? outcome.error,
              error: outcome.error,
              workspaceId: req.workspaceId,
              correlationId: req.correlationId,
            })
          },
        })

        const toolCallsRun = loop.calls
        let finalText = loop.exhausted ? loop.text || 'Max tool iterations reached.' : loop.text

        if (!finalText && toolCallsRun.length === 0) {
          const gen = await withProviderRetry(() => provider.stream({ messages: llmMessages, temperature: 0.7, maxTokens: DEMO_MAX_TOKENS }))
          for await (const chunk of gen) {
            if (signal?.aborted) break
            if (chunk.delta) {
              output += chunk.delta
              outputChars += chunk.delta.length
              encode(controller, {
                type: 'workspace.token',
                memberId: req.memberId,
                data: chunk.delta,
                workspaceId: req.workspaceId,
                correlationId: req.correlationId,
              })
            }
            if (chunk.done) break
          }
          finalText = output || finalText
        } else if (finalText) {
          for (let i = 0; i < finalText.length; i += TOKEN_CHUNK) {
            if (signal?.aborted) break
            const chunk = finalText.slice(i, i + TOKEN_CHUNK)
            output += chunk
            outputChars += chunk.length
            encode(controller, {
              type: 'workspace.token',
              memberId: req.memberId,
              data: chunk,
              workspaceId: req.workspaceId,
              correlationId: req.correlationId,
            })
          }
        }

        output = finalText || output

        if (signal?.aborted) {
          wsLog('warn', 'workspace.aborted', { memberId: req.memberId })
          emitTrace('error')
          encode(controller, {
            type: 'workspace.turn_end',
            memberId: req.memberId,
            decision: 'handoff',
            workspaceId: req.workspaceId,
            correlationId: req.correlationId,
          })
          return
        }

        wsLog('info', 'workspace.turn_end', { memberId: req.memberId, outputChars })
        encode(controller, {
          type: 'workspace.turn_end',
          memberId: req.memberId,
          decision: 'pass',
          workspaceId: req.workspaceId,
          correlationId: req.correlationId,
        })
        encode(controller, {
          type: 'workspace.status',
          memberId: req.memberId,
          status: 'done',
          workspaceId: req.workspaceId,
          correlationId: req.correlationId,
        })
        emitTrace('success')
        logger.info('workspace.turn_complete', { ...workspaceMeta, durationMs: Math.round(performance.now() - startTime), outputChars })
      } catch (err) {
        if (signal?.aborted) {
          wsLog('warn', 'workspace.aborted', { memberId: req.memberId })
          return
        }
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('workspace.error', { ...workspaceMeta, error: msg })
        wsLog('error', 'workspace.error', { memberId: req.memberId })
        encode(controller, {
          type: 'workspace.error',
          data: msg,
          workspaceId: req.workspaceId,
          correlationId: req.correlationId,
        })
      } finally {
        controller.close()
      }
    },
  })
}
