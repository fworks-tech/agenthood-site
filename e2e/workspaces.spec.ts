import { expect } from '@playwright/test'
import { test } from './fixtures'

function wsBody(lines: Record<string, unknown>[]): string {
  return lines.map((e) => JSON.stringify(e) + '\n').join('')
}

function mediatorPlan(members: { id: string; task: string; order: number }[]) {
  return JSON.stringify({ members })
}

async function mockWorkspaceSequence(
  page: import('@playwright/test').Page,
  turns: Array<{ memberId: string; tokens?: string[]; toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>; handoff?: string; error?: string; delayMs?: number }>,
) {
  let callIdx = 0
  await page.route('**/api/studio/workspaces*', async (route) => {
    const req = route.request()
    if (req.method() !== 'POST') {
      await route.continue()
      return
    }
    let body: Record<string, unknown> = {}
    try {
      body = req.postDataJSON() as Record<string, unknown>
    } catch {}
    const turn = turns[callIdx] ?? turns[turns.length - 1]
    callIdx++
    if (turn.delayMs) await new Promise((r) => setTimeout(r, turn.delayMs))
    const memberId = (body.memberId as string) ?? turn.memberId
    const workspaceId = (body.workspaceId as string) ?? `ws-${callIdx}`
    const correlationId = (body.correlationId as string) ?? `corr-${callIdx}`
    const turnIndex = (body.turnIndex as number) ?? 0

    if (turn.error) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: wsBody([
          { type: 'workspace.started', instruction: body.instruction ?? '', members: body.memberIds ?? [], workspaceId, correlationId },
          { type: 'workspace.error', data: turn.error, workspaceId, correlationId },
        ]),
      })
      return
    }

    const events: Record<string, unknown>[] = []
    events.push({ type: 'workspace.started', instruction: body.instruction ?? '', members: body.memberIds ?? [memberId], workspaceId, correlationId })
    events.push({ type: 'workspace.turn_start', memberId, role: memberId, turnIndex, workspaceId, correlationId })
    events.push({ type: 'workspace.status', memberId, status: 'working', workspaceId, correlationId })
    if (turn.toolCalls) {
      for (const tc of turn.toolCalls) {
        const id = `call_${Math.random().toString(36).slice(2, 6)}`
        events.push({ type: 'workspace.tool_call', memberId, id, name: tc.name, args: tc.args, workspaceId, correlationId })
        events.push({ type: 'workspace.tool_result', memberId, id, name: tc.name, result: tc.result ?? 'tool ok', workspaceId, correlationId })
        if (tc.name === 'code_execution' && turn.handoff) {
          events.push({ type: 'workspace.handoff', memberId, reason: turn.handoff, options: ['continue', 'stop'], workspaceId, correlationId })
        }
      }
    }
    if (turn.tokens) {
      for (const t of turn.tokens) {
        events.push({ type: 'workspace.token', memberId, data: t, workspaceId, correlationId })
      }
    }
    if (turn.handoff && !turn.toolCalls) {
      events.push({ type: 'workspace.handoff', memberId, reason: turn.handoff, options: ['continue', 'stop'], workspaceId, correlationId })
    }
    events.push({ type: 'workspace.turn_end', memberId, decision: turn.handoff ? 'handoff' : 'pass', workspaceId, correlationId })
    events.push({ type: 'workspace.status', memberId, status: 'done', workspaceId, correlationId })
    events.push({ type: 'workspace.done', totalCost: 0, turns: turnIndex + 1, result: 'ok', workspaceId, correlationId })
    // also emit a log event for LiveLogs
    events.push({ type: 'log', level: 'info', event: 'workspace.turn_complete', workspaceId, correlationId, memberId })

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'x-correlation-id': correlationId, 'x-workspace-id': workspaceId },
      body: wsBody(events),
    })
  })
}

test.describe('Workspaces — Multi-agent orchestration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio/workspaces')
    await page.waitForLoadState('networkidle')
  })

  test('picker renders categories and excludes mediator', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
    await expect(page.getByText('Assemble a team, give one instruction')).toBeVisible()
    for (const cat of ['Engineering', 'Validation', 'Lifecycle', 'Knowledge']) {
      await expect(page.getByRole('heading', { name: cat })).toBeVisible()
    }
    // mediator is auto-included, not in grid
    await expect(page.getByText('The Mediator')).not.toBeVisible()
    // at least one builder
    await expect(page.getByRole('button', { name: /The Builder/ })).toBeVisible()
  })

  test('selecting members toggles and reveals instruction', async ({ page }) => {
    const builderBtn = page.getByRole('button', { name: /The Builder/ }).first()
    await expect(builderBtn).toBeVisible()
    await builderBtn.click()
    await expect(builderBtn).toHaveClass(/border-indigo-500/)
    // instruction textarea fades in
    const textarea = page.getByPlaceholder('e.g. Suggest an area for improvement')
    await expect(textarea).toBeVisible()
    const startBtn = page.getByRole('button', { name: 'Start Workspace' })
    await expect(startBtn).toBeDisabled()
    await textarea.fill('Hello workspace')
    await expect(startBtn).toBeEnabled()
    // deselect
    await builderBtn.click()
    await expect(builderBtn).not.toHaveClass(/border-indigo-500/)
  })

  test('full orchestration renders live chat with multi-agent turns', async ({ page }) => {
    const plan = mediatorPlan([
      { id: 'the-builder', task: 'build feature', order: 0 },
      { id: 'the-tester', task: 'test feature', order: 1 },
    ])
    await mockWorkspaceSequence(page, [
      { memberId: 'the-mediator', tokens: [plan] },
      { memberId: 'the-builder', tokens: ['Implementing feature...\n```ts\nconst x=1\n```'], toolCalls: [{ name: 'web_fetch', args: { url: 'https://github.com/fworks-tech/agenthood' }, result: 'repo content' }] },
      { memberId: 'the-tester', tokens: ['Tests pass.\n```ts\ntest()\n```'] },
    ])

    await page.getByRole('button', { name: /The Builder/ }).first().click()
    await page.getByRole('button', { name: /The Tester/ }).first().click()
    const textarea = page.getByPlaceholder('e.g. Suggest an area for improvement')
    await textarea.fill('Suggest an area for improvement for https://github.com/fworks-tech/agenthood')
    await page.getByRole('button', { name: 'Start Workspace' }).click()

    // sidebar appears with mediator first
    await expect(page.getByText('The Mediator').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('The Builder').first()).toBeVisible()
    await expect(page.getByText('The Tester').first()).toBeVisible()

    // chat messages appear sequentially — mediator plan is hidden, builder and tester polished
    await expect(page.getByText('Implementing feature...')).toBeVisible({ timeout: 15000 })
    // raw tool markers and tool results are NOT shown in the polished chat
    await expect(page.getByText('[tool_call:')).not.toBeVisible()
    await expect(page.getByText('repo content')).not.toBeVisible()
    // mediator routing JSON is hidden from chat too
    await expect(page.getByText('"members"')).not.toBeVisible()
    // builder turn shows tool-call count and a View logs action
    await expect(page.getByText('1 tool calls').first()).toBeVisible({ timeout: 15000 })
    // open the builder card's View logs dialog (scoped to the card, not the mediator's)
    const builderCard = page.locator('div.mantine-Paper-root').filter({ hasText: 'Implementing feature...' })
    await builderCard.getByRole('button', { name: 'View logs' }).click()
    await expect(page.getByRole('dialog').getByText('web_fetch').first()).toBeVisible({ timeout: 5000 })
    // expand the tool row to reveal its result
    await page.getByRole('dialog').getByText('web_fetch').first().click()
    await expect(page.getByRole('dialog').getByText('repo content').first()).toBeVisible({ timeout: 5000 })
    // close modal
    await page.keyboard.press('Escape')
    await expect(page.getByText('Tests pass.').first()).toBeVisible({ timeout: 15000 })

    // sidebar status done for at least builder
    await expect(page.locator('text=done').first()).toBeVisible({ timeout: 5000 })
  })

  test('handoff checkpoint shows Continue/Stop and is interactive', async ({ page }) => {
    await mockWorkspaceSequence(page, [
      { memberId: 'the-mediator', tokens: [mediatorPlan([{ id: 'the-builder', task: 'run code', order: 0 }])] },
      { memberId: 'the-builder', tokens: ['About to run code\n```ts\ncode\n```'], handoff: 'code_execution requested — awaiting human approval' },
    ])

    await page.getByRole('button', { name: /The Builder/ }).first().click()
    await page.getByPlaceholder('e.g. Suggest an area for improvement').fill('Run code please')
    await page.getByRole('button', { name: 'Start Workspace' }).click()

    await expect(page.getByText('Human checkpoint')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('code_execution requested')).toBeVisible()
    const continueBtn = page.getByRole('button', { name: 'Continue' })
    const stopBtn = page.getByRole('button', { name: 'Stop' }).first()
    await expect(continueBtn).toBeVisible()
    await expect(stopBtn).toBeVisible()
    await continueBtn.click()
    await expect(page.getByText('Human checkpoint')).not.toBeVisible({ timeout: 5000 })
  })

  test('user intervention appends message and re-invokes mediator', async ({ page }) => {
    await mockWorkspaceSequence(page, [
      { memberId: 'the-mediator', tokens: [mediatorPlan([{ id: 'the-builder', task: 'initial task', order: 0 }])] },
      { memberId: 'the-builder', tokens: ['Working...\n```ts\nx\n```'], delayMs: 8000 },
      // intervention: mediator re-plans as JSON, builder then produces final output
      { memberId: 'the-mediator', tokens: [mediatorPlan([{ id: 'the-builder', task: 'edge cases', order: 0 }])] },
      { memberId: 'the-builder', tokens: ['Done with edge cases.\n```ts\ndone\n```'] },
    ])

    await page.getByRole('button', { name: /The Builder/ }).first().click()
    await page.getByPlaceholder('e.g. Suggest an area for improvement').fill('Initial task')
    await page.getByRole('button', { name: 'Start Workspace' }).click()

    // wait for workspace to be running (builder turn is delayed 8s, so we intervene while still running)
    const input = page.getByPlaceholder(/Send a message to intervene|Send a follow-up/)
    await expect(input).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(600)
    await input.fill('Also check edge cases')
    await page.getByRole('button', { name: 'Send' }).click()
    // user bubble is rendered as a right-aligned indigo bubble (intervention keeps it running)
    await expect(page.getByText('Also check edge cases').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Done with edge cases.')).toBeVisible({ timeout: 15000 })
  })

  test('error banner surfaces workspace.error', async ({ page }) => {
    await mockWorkspaceSequence(page, [
      { memberId: 'the-mediator', tokens: [mediatorPlan([{ id: 'the-builder', task: 'x', order: 0 }])] },
      { memberId: 'the-builder', error: 'provider down' },
    ])

    await page.getByRole('button', { name: /The Builder/ }).first().click()
    await page.getByPlaceholder('e.g. Suggest an area for improvement').fill('Trigger error')
    await page.getByRole('button', { name: 'Start Workspace' }).click()

    await expect(page.getByText(/provider down|Workspace turn failed/)).toBeVisible({ timeout: 15000 })
  })

  test('mobile drawer shows agents on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/studio/workspaces')
    await page.getByRole('button', { name: /The Builder/ }).first().click()
    await page.getByPlaceholder('e.g. Suggest an area for improvement').fill('Mobile test')
    await mockWorkspaceSequence(page, [
      { memberId: 'the-mediator', tokens: [mediatorPlan([{ id: 'the-builder', task: 'x', order: 0 }])] },
      { memberId: 'the-builder', tokens: ['Mobile hello\n```ts\nx\n```'] },
    ])
    await page.getByRole('button', { name: 'Start Workspace' }).click()

    await expect(page.getByText('Mobile hello')).toBeVisible({ timeout: 15000 })
    // mobile agents button — drawer
    const agentsBtn = page.getByRole('button', { name: 'Agents' })
    await expect(agentsBtn).toBeVisible()
    await agentsBtn.click()
    await expect(page.locator('.mantine-Drawer-content').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.mantine-Drawer-content').getByText('The Builder').first()).toBeVisible({ timeout: 5000 })
  })
})
