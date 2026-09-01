import { getDefaultModel } from '../_types/studio'
import { buildMemberMessages, type ThreadMessage } from './workspace-orchestrator'

const SYNTHESIS_SYSTEM = `You are the Workspace Synthesizer — the final voice the user hears, exactly like Claude Work.

Your job: read the full shared thread (user instructions + every member's polished replies) and produce a single natural, helpful final answer for the user.

Rules:
- Be concise, warm, and directly answer the user's latest intent using prior context.
- If the thread is about "Suggest an area for improvement" for a repo, synthesize the members' findings into one prioritized recommendation (not a meta handoff).
- Never mention internal routing, tool markers, or that you are a synthesizer. No "as an AI" preamble.
- Use markdown with headings, bullets, and code blocks where useful. Keep it under 800 words.
- If no prior thread exists, answer the latest user prompt directly.`

export async function createSynthesisStream(
  thread: ThreadMessage[],
  workspaceMeta: { workspaceId: string; correlationId: string },
  signal?: AbortSignal,
): Promise<ReadableStream> {
  const model = getDefaultModel('opencode-go')

  // Build messages: system + full thread
  const messages = buildMemberMessages(SYNTHESIS_SYSTEM, thread)

  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const startAt = performance.now()
      try {
        const { LLMRouter } = await import('agenthood/dist/llm')
        const llmConfig = {
          providers: [{ name: 'opencode-go' }, { name: 'opencode' }, { name: 'anthropic' }, { name: 'groq' }, { name: 'ollama' }],
          failureThreshold: 3,
          cooldownMs: 60000,
          probeEnabled: true,
        }
        const provider = await LLMRouter.fromConfig(llmConfig as never)
        try {
          provider.setModel(model)
        } catch {}

        controller.enqueue(
          enc.encode(
            JSON.stringify({ type: 'workspace.synthesized_start', workspaceId: workspaceMeta.workspaceId, correlationId: workspaceMeta.correlationId }) + '\n',
          ),
        )

        // Stream synthesis
        const llmMessages = messages.map((m) => ({ role: m.role as never, content: m.content }))
        const gen = await provider.stream({ messages: llmMessages, temperature: 0.7 } as never)
        let output = ''
        for await (const chunk of gen) {
          if (signal?.aborted) break
          if (chunk.delta) {
            output += chunk.delta
            controller.enqueue(
              enc.encode(
                JSON.stringify({
                  type: 'workspace.synthesized',
                  data: chunk.delta,
                  workspaceId: workspaceMeta.workspaceId,
                  correlationId: workspaceMeta.correlationId,
                }) + '\n',
              ),
            )
          }
          if (chunk.done) break
        }

        // Fallback to single complete if stream empty (some providers)
        if (!output) {
          const resp = await provider.complete({ messages: llmMessages, temperature: 0.7 } as never)
          if (resp.content) {
            for (let i = 0; i < resp.content.length; i += 128) {
              const slice = resp.content.slice(i, i + 128)
              controller.enqueue(
                enc.encode(
                  JSON.stringify({
                    type: 'workspace.synthesized',
                    data: slice,
                    workspaceId: workspaceMeta.workspaceId,
                    correlationId: workspaceMeta.correlationId,
                  }) + '\n',
                ),
              )
            }
          }
        }

        controller.enqueue(
          enc.encode(
            JSON.stringify({
              type: 'workspace.synthesized_end',
              workspaceId: workspaceMeta.workspaceId,
              correlationId: workspaceMeta.correlationId,
              durationMs: Math.round(performance.now() - startAt),
            }) + '\n',
          ),
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(enc.encode(JSON.stringify({ type: 'workspace.synthesized_error', data: msg }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })
}
