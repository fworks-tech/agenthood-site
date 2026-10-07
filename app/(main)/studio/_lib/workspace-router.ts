// Confidence-gated next-member routing for watch-by-default workspaces.
// Pure: no LLM, no I/O — the deterministic layer before mediator fallback.

export const AUTO_THRESHOLD = 70
export const ASK_THRESHOLD = 50
export const MAX_AUTO_HOPS = 8

// Full-cycle order is the default successor; lane chains override the head.
const FULL_CYCLE = [
  'the-strategist',
  'the-architect',
  'the-tester',
  'the-builder',
  'the-reviewer',
  'the-auditor',
  'the-warden',
  'the-doorman',
  'the-scribe',
  'the-herald',
  'the-librarian',
] as const

const LANE_HEAD: Record<string, string> = {
  'the-debugger': 'the-tester',
  'the-oracle': 'the-sentinel',
  'the-sentinel': 'the-builder',
}

export function getChainSuccessor(memberId: string): string | null {
  if (LANE_HEAD[memberId]) return LANE_HEAD[memberId]
  const idx = FULL_CYCLE.indexOf(memberId as (typeof FULL_CYCLE)[number])
  if (idx === -1) return null
  return FULL_CYCLE[idx + 1] ?? null
}

export function parseHandoffMention(output: string, validIds: string[]): string | null {
  const m = output.match(/talk to the[ -]([a-z]+)/i)
  if (!m) return null
  const id = `the-${m[1].toLowerCase()}`
  return validIds.includes(id) ? id : null
}

export type ScoredNext = { nextId: string; confidence: number; reason: string }

export function scoreNext(output: string, fromId: string, validIds: string[]): ScoredNext | null {
  const mentioned = parseHandoffMention(output, validIds)
  if (mentioned) return { nextId: mentioned, confidence: 95, reason: `lane deferral in ${fromId} output` }
  const successor = getChainSuccessor(fromId)
  if (successor && validIds.includes(successor)) {
    return { nextId: successor, confidence: 78, reason: `chain successor of ${fromId}` }
  }
  return null
}

export function shouldContinue(opts: { hops: number; history: string[]; lastOutput: string }): {
  stop: boolean
  reason?: string
} {
  if (opts.hops >= MAX_AUTO_HOPS) return { stop: true, reason: 'hop cap reached' }
  const tail = opts.history.slice(-3)
  if (tail.length === 3 && tail[0] === tail[1] && tail[1] === tail[2]) {
    return { stop: true, reason: 'repeat loop detected' }
  }
  // Only an explicit blocking statement stops the loop — a member reporting
  // that something "failed" (e.g. a test it already fixed) must not halt it.
  if (/\bblocking\b/i.test(opts.lastOutput)) return { stop: true, reason: 'blocking signal' }
  return { stop: false }
}
