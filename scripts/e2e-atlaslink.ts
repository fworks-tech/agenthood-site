import { createWorkspaceTurnStream as createTurn } from '../app/(main)/studio/_lib/workspace-adapter'
import { parseMediatorPlan, fallbackPlan } from '../app/(main)/studio/_lib/workspace-orchestrator'
import { TURN_BUDGET_DEFAULT } from '../app/(main)/studio/_types/workspace'
import fs from 'fs'
import path from 'path'

const instruction = 'I want you to find an area to improve my repo https://github.com/fworks-tech/atlaslink, give me an explanation, code snippets, tests and an overall review of this suggestion for me implement it'
const memberIds = ['the-builder', 'the-tester', 'the-reviewer']
const workspaceId = `ws-e2e-${Date.now()}`
const correlationId = `ws-corr-e2e-${Date.now()}`

type ThreadMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }

async function collectStream(stream: ReadableStream): Promise<{ events: any[]; content: string }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events: any[] = []
  let content = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = typeof value === 'string' ? value : decoder.decode(value as Uint8Array, { stream: true })
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const evt = JSON.parse(trimmed)
        events.push(evt)
        if (evt.type === 'workspace.token' && typeof evt.data === 'string') content += evt.data
        if (evt.type === 'workspace.tool_call') content += `\n[tool_call ${evt.name}]\n`
        if (evt.type === 'workspace.tool_result') content += `\n[tool_result ${String(evt.result ?? evt.error).slice(0, 400)}]\n`
      } catch {}
    }
  }
  if (buffer.trim()) {
    try {
      const evt = JSON.parse(buffer.trim())
      events.push(evt)
    } catch {}
  }
  return { events, content }
}

async function run() {
  console.log(`Workspace ${workspaceId} correlation ${correlationId}`)
  console.log(`Instruction: ${instruction}`)
  console.log(`Members: ${memberIds.join(', ')}`)
  const thread: ThreadMsg[] = [{ role: 'user', content: instruction }]
  const allTrajectories: Record<string, any> = {}
  let mediatorContent = ''

  console.log('\n=== MEDIATOR TURN ===')
  const medStream = await createTurn({ workspaceId, correlationId, memberId: 'the-mediator', instruction, thread, turnIndex: 0 })
  const medRes = await collectStream(medStream)
  mediatorContent = medRes.content
  allTrajectories['the-mediator'] = medRes.events
  console.log(`Mediator output (${medRes.events.length} events, ${mediatorContent.length} chars):\n${mediatorContent.slice(0, 2000)}\n`)
  thread.push({ role: 'assistant', content: mediatorContent })

  const plan = parseMediatorPlan(mediatorContent, memberIds) ?? fallbackPlan({ memberIds, instruction })
  console.log(`\n=== PLAN ===\n${JSON.stringify(plan, null, 2)}\n`)

  let turnIndex = 1
  for (const m of plan.members) {
    if (turnIndex > TURN_BUDGET_DEFAULT) break
    console.log(`\n=== TURN ${turnIndex}: ${m.id} — task: ${m.task.slice(0, 120)} ===`)
    const stream = await createTurn({ workspaceId, correlationId, memberId: m.id, instruction: m.task, thread, turnIndex })
    const res = await collectStream(stream)
    allTrajectories[m.id] = res.events
    console.log(` -> ${res.content.length} chars, ${res.events.length} events`)
    console.log(res.content.slice(0, 1500))
    const handoff = res.events.find((e: any) => e.type === 'workspace.handoff')
    if (handoff) console.log(`    [HANDOFF] ${handoff.reason}`)
    thread.push({ role: 'assistant', content: res.content })
    turnIndex++
  }

  const outDir = path.join(process.cwd(), 'data', 'workspaces', 'trajectories')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `e2e-atlaslink-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify({ workspaceId, correlationId, instruction, memberIds, plan, trajectories: allTrajectories, thread }, null, 2))
  console.log(`\n=== SAVED trajectory to ${outPath} ===`)
  for (const [mem, evts] of Object.entries(allTrajectories)) {
    const p = path.join(outDir, `${mem}-atlaslink-${Date.now()}.json`)
    fs.writeFileSync(p, JSON.stringify({ workspaceId, correlationId, memberId: mem, events: evts }, null, 2))
    console.log(`  - ${mem}: ${p} (${(evts as any[]).length} events)`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
