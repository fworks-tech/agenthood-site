import { parseMediatorPlan } from './workspace-orchestrator'

export type CommandLastTurn = { memberId: string; task: string; raw: string }
export type CommandPendingRoute = { id: string; task: string; confidence: number }
export type ThreadMode = 'filtered' | 'raw' | 'skip'

export type CommandCtx = {
  takeTurn: (memberId: string, task: string, wId: string, correlationId: string, opts?: { threadMode?: ThreadMode; onRecorded?: (raw: string) => void }) => Promise<string>
  pump: (wId: string, correlationId: string, session: number) => Promise<void>
  settle: (wId: string, correlationId: string, session: number) => Promise<void>
  afterTurn: (m: string, r: string, w: string, c: string, s: number) => Promise<'continue' | 'paused' | 'done'>
  runSynthesis: (wId: string, correlationId: string) => Promise<string | null>
  pushCommand: (content: string) => void
  stop: () => void
  reset: () => void
  setRunning: () => void
  getSpec: () => { memberIds: string[]; instruction: string } | null
  getLastTurn: () => CommandLastTurn | null
  /** Consumes the paused ask-inline proposal (clears the pause) or null. */
  takePending: () => CommandPendingRoute | null
  enqueue: (turn: { id: string; task: string }) => void
  appendThreadUser: (content: string) => void
  isCurrentSession: (s: number) => boolean
}

export type ParsedInputCommand = { name: string; args: string; unknown?: boolean }

/** Local `/` command execution. Pure routing over an injected context — every
 *  branch is unit-testable without the hook. Unknown commands never touch LLM. */
export async function runWorkspaceCommand(
  cmd: ParsedInputCommand,
  run: { wId: string; correlationId: string; session: number },
  ctx: CommandCtx,
): Promise<'handled' | 'passthrough'> {
  const { name, args } = cmd
  const { wId, correlationId, session } = run
  if (name === 'stop') {
    ctx.stop()
    return 'handled'
  }
  if (name === 'new') {
    ctx.reset()
    return 'handled'
  }
  if (cmd.unknown) {
    ctx.pushCommand(`Unknown command \`/${name}\` — try \`/help\`.`)
    return 'handled'
  }
  if (name === 'summarize') {
    await ctx.runSynthesis(wId, correlationId)
    return 'handled'
  }
  if (name === 'retry') {
    const last = ctx.getLastTurn()
    if (!last) {
      ctx.pushCommand('Nothing to retry yet.')
      return 'handled'
    }
    const raw = await ctx.takeTurn(last.memberId, last.task, wId, correlationId)
    if (!ctx.isCurrentSession(session)) return 'handled'
    const r = await ctx.afterTurn(last.memberId, raw, wId, correlationId, session)
    if (r === 'continue') await ctx.pump(wId, correlationId, session)
    if (ctx.isCurrentSession(session)) await ctx.settle(wId, correlationId, session)
    return 'handled'
  }
  if (name === 'help') {
    const ids = ctx.getSpec()?.memberIds ?? []
    ctx.pushCommand(
      `**Commands** — \`/summarize\` \`/continue [hint]\` \`/retry\` \`/plan\` \`/stop\` \`/new\` \`/help\`\n\n**Mentions** — \`@member\` talks directly (mediator skipped)${
        ids.length > 0 ? `: ${ids.map((i) => `\`@${i}\``).join(' ')} \`@user\`` : ''
      }`,
    )
    return 'handled'
  }
  if (name === 'plan') {
    const spec = ctx.getSpec()
    const raw = await ctx.takeTurn(
      'the-mediator',
      `List the execution plan for: ${args || spec?.instruction || 'the current workspace goal'}. Reply with ONLY this JSON, no prose: {"members":[{"id":"<member>","task":"<task>","order":0}]}`,
      wId,
      correlationId,
      { threadMode: 'raw' },
    )
    if (!ctx.isCurrentSession(session)) return 'handled'
    const plan = parseMediatorPlan(raw, spec?.memberIds ?? [])
    ctx.pushCommand(
      plan
        ? `**Plan** — ${plan.members.map((m) => `\`${m.id}\`: ${m.task.slice(0, 120)}`).join('\n')}`
        : 'The mediator returned no usable plan.',
    )
    return 'handled'
  }
  if (name === 'continue') {
    const p = ctx.takePending()
    if (p) {
      ctx.setRunning()
      ctx.enqueue({ id: p.id, task: args ? `${p.task}\n\nUser hint: ${args}` : p.task })
      await ctx.pump(wId, correlationId, session)
      if (ctx.isCurrentSession(session)) await ctx.settle(wId, correlationId, session)
      return 'handled'
    }
    if (args) ctx.appendThreadUser(args)
    const last = ctx.getLastTurn()
    if (!last) {
      ctx.pushCommand('Nothing to continue yet — send an instruction first.')
      return 'handled'
    }
    const r = await ctx.afterTurn(last.memberId, last.raw, wId, correlationId, session)
    if (r === 'continue') await ctx.pump(wId, correlationId, session)
    if (r === 'done' && ctx.isCurrentSession(session)) await ctx.settle(wId, correlationId, session)
    return 'handled'
  }
  return 'passthrough'
}
