import { agentSkills } from '../_data/agents.generated'
import { getToolSchemas, executeTool, MAX_TOOL_ITERATIONS, classifyToolResult } from './tools'
import type { ToolCall } from './tools'
import { logger } from './logger'
import { emitLogEvent, buildTraceEnvelope, createWorkspaceTraceMeta } from './trace'
import { getDefaultModel } from '../_types/studio'
import { buildMemberMessages, shouldRequestHandoff, type ThreadMessage } from './workspace-orchestrator'
import type { Message } from 'agenthood/dist/llm/types'

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

export async function createWorkspaceTurnStream(
  req: WorkspaceTurnRequest,
  signal?: AbortSignal,
): Promise<ReadableStream> {
  const systemPrompt = agentSkills[req.memberId]
  if (!systemPrompt) throw new Error(`No system prompt for agent "${req.memberId}"`)

  const providerName = 'opencode-go' as const
  const model = getDefaultModel('opencode-go')
  const enabledTools = ['web_fetch', 'code_execution']
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
        const llmConfig = {
          providers: [
            { name: providerName },
            { name: 'opencode' },
            { name: 'anthropic' },
            { name: 'groq' },
            { name: 'ollama' },
          ],
          failureThreshold: 3,
          cooldownMs: 60000,
          probeEnabled: true,
        }
        const provider = await LLMRouter.fromConfig(llmConfig as never)
        try {
          provider.setModel(model)
        } catch {}

        const toolCallsRun: ToolCall[] = []
        const llmMessages: Message[] = messages.map((m) => ({
          role: m.role as never,
          content: m.content,
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id, name: m.name } : {}),
        }))

        let finalText = ''
        let handoffEmitted = false

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          if (signal?.aborted) break
          const resp = await provider.complete({
            messages: llmMessages,
            tools: toolSchemas,
            temperature: 0.7,
          })

          if (!resp.toolCalls || resp.toolCalls.length === 0) {
            finalText = resp.content
            break
          }

          const needsHandoff = resp.toolCalls.some((tc) => shouldRequestHandoff(tc.name))
          if (needsHandoff && !handoffEmitted) {
            handoffEmitted = true
            const handoffPayload = {
              type: 'workspace.handoff',
              memberId: req.memberId,
              reason: 'code_execution requested — awaiting human approval',
              options: ['continue', 'stop'],
              workspaceId: req.workspaceId,
              correlationId: req.correlationId,
            }
            encode(controller, handoffPayload)
            wsLog('info', 'workspace.handoff', { memberId: req.memberId, reason: handoffPayload.reason })
          }

          llmMessages.push({
            role: 'assistant',
            content: resp.content || '',
            toolCalls: resp.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args })),
          } as never)

          for (const tc of resp.toolCalls) {
            if (signal?.aborted) break
            const args = tc.args as Record<string, unknown>
            encode(controller, {
              type: 'workspace.tool_call',
              memberId: req.memberId,
              id: tc.id,
              name: tc.name,
              args,
              workspaceId: req.workspaceId,
              correlationId: req.correlationId,
            })
            wsLog('info', 'workspace.tool_call', { memberId: req.memberId, tool: tc.name })
            const result = await executeTool(tc.name, args, signal)
            const outcome = classifyToolResult(result)
            toolCallsRun.push({ id: tc.id, name: tc.name, args, result: outcome.result, error: outcome.error })
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
            llmMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: tc.name } as never)
          }

          if (i === MAX_TOOL_ITERATIONS - 1) {
            finalText = resp.content || 'Max tool iterations reached.'
          } else if (!handoffEmitted) {
            continue
          } else {
            finalText = resp.content || ''
            break
          }
        }

        if (!finalText && toolCallsRun.length === 0) {
          const streamReq = {
            messages: llmMessages,
            temperature: 0.7,
          }
          const gen = await provider.stream(streamReq as never)
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
          for (const ch of finalText) {
            if (signal?.aborted) break
            output += ch
            outputChars++
            encode(controller, {
              type: 'workspace.token',
              memberId: req.memberId,
              data: ch,
              workspaceId: req.workspaceId,
              correlationId: req.correlationId,
            })
          }
        }

        for (const tc of toolCallsRun) {
          if (!tc.result && !tc.error) continue
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
