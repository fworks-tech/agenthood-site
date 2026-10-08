import { getChainSuccessor } from './workspace-router'
import { findUserQuestion, hasUserMention } from './workspace-engine'
import { isEmptyPing, parseWorkspaceCommand } from './workspace-commands'
import type { ThreadMessage } from './workspace-orchestrator'
import type { WorkspaceReaction } from '../_types/workspace'

// Signature emoji per member — the same fantasy the avatar carries, reused as
// the agent's default reaction voice.
export const SIGNATURE_EMOJI: Record<string, string> = {
  'the-strategist': '🎯',
  'the-architect': '🏗️',
  'the-builder': '🛠️',
  'the-reviewer': '🔍',
  'the-tester': '🧪',
  'the-debugger': '🐛',
  'the-auditor': '🔒',
  'the-herald': '📦',
  'the-librarian': '📝',
  'the-mailman': '📮',
  'the-doorman': '🚪',
  'the-oracle': '🔮',
  'the-envoy': '🌐',
  'the-sentinel': '👁️',
  'the-warden': '⚖️',
  'the-steward': '🧭',
  'the-operator': '🩺',
  'the-inspector': '🔬',
  'the-mediator': '🔀',
}

// Quick picker offered on every bubble (user + agents can reuse it).
export const QUICK_EMOJI = ['👍', '👀', '✅', '🎉', '🔥', '🫡', '🤔', '❤️'] as const

const MAX_PER_MESSAGE = 6

function signalEmoji(content: string): string | null {
  const t = content.toLowerCase()
  if (/(blocking|failed|error|bug|broke|incident)/.test(t)) return '🫡'
  if (/(shipped|done|ready|merged|deployed|fixed|verde|pronto)/.test(t)) return '🎉'
  if (content.includes('```')) return '✅'
  if (/\?$/.test(content.trim())) return '👀'
  return null
}

// Autonomous reaction: at most ONE emoji per message, deterministic (no extra
// LLM calls — the voice comes from the reactor's signature + content signal).
// Blocking questions (@user) get none — the room is frozen for the human.
export function suggestReactions(opts: {
  content: string
  authorId: string
  memberIds: string[]
}): WorkspaceReaction[] {
  const { content, authorId, memberIds } = opts
  if (!content.trim() || isEmptyPing(content) || parseWorkspaceCommand(content)) return []
  if (authorId !== 'user' && (hasUserMention(content) || findUserQuestion(content, memberIds))) return []
  const room = memberIds.filter((id) => id !== authorId)
  if (room.length === 0) return []

  if (authorId === 'user') {
    const reactor = memberIds.includes('the-mediator') ? 'the-mediator' : room[0]
    const emoji = /\?/.test(content) ? '👀' : '👍'
    return [{ emoji, byMemberId: reactor }]
  }

  const successor = getChainSuccessor(authorId)
  const reactor = successor && room.includes(successor) ? successor : room[content.length % room.length]
  const emoji = signalEmoji(content) ?? SIGNATURE_EMOJI[reactor] ?? '👍'
  return [{ emoji, byMemberId: reactor }]
}

export function toggleReaction(
  current: WorkspaceReaction[] | undefined,
  emoji: string,
  byMemberId: string,
): WorkspaceReaction[] {
  const list = current ?? []
  const ix = list.findIndex((r) => r.emoji === emoji && r.byMemberId === byMemberId)
  if (ix >= 0) return list.filter((_, i) => i !== ix)
  if (list.length >= MAX_PER_MESSAGE) return list
  return [...list, { emoji, byMemberId }]
}

const REACTION_PREFIX = '[reaction]'
const MAX_REACTION_LINES = 40

// Thread mirror of a reaction: a tiny user-role line so every later turn
// (LLM context = trimmed thread) sees messages AND reactions. Kept short,
// capped, and clearly prefixed — never mistaken for a real user message.
export function reactionThreadLines(
  content: string,
  authorId: string,
  memberIds: string[],
): ThreadMessage[] {
  const reactions = suggestReactions({ content, authorId, memberIds })
  return reactions.map((r) => ({
    role: 'user' as const,
    content: `${REACTION_PREFIX} ${r.byMemberId} reacted ${r.emoji}`,
  }))
}

export function appendThreadWithReactionCap(thread: ThreadMessage[], lines: ThreadMessage[]): ThreadMessage[] {
  if (lines.length === 0) return thread
  const next = [...thread, ...lines]
  const reactionIdx = next
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.role === 'user' && m.content.startsWith(REACTION_PREFIX))
    .map(({ i }) => i)
  if (reactionIdx.length <= MAX_REACTION_LINES) return next
  const drop = new Set(reactionIdx.slice(0, reactionIdx.length - MAX_REACTION_LINES))
  return next.filter((_, i) => !drop.has(i))
}
