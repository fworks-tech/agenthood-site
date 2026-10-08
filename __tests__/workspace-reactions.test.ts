import { describe, it, expect } from 'vitest'
import {
  suggestReactions,
  toggleReaction,
  QUICK_EMOJI,
  SIGNATURE_EMOJI,
  reactionThreadLines,
  appendThreadWithReactionCap,
} from '../app/(main)/studio/_lib/workspace-reactions'

const IDS = ['the-mediator', 'the-builder', 'the-tester']

describe('suggestReactions', () => {
  it('acks a user question with eyes from the mediator', () => {
    expect(suggestReactions({ content: 'vocês conseguem?', authorId: 'user', memberIds: IDS })).toEqual([
      { emoji: '👀', byMemberId: 'the-mediator' },
    ])
  })

  it('acks a plain user message with a thumbs up', () => {
    expect(suggestReactions({ content: 'vamos lá', authorId: 'user', memberIds: IDS })).toEqual([
      { emoji: '👍', byMemberId: 'the-mediator' },
    ])
  })

  it('stays silent on blocking @user questions', () => {
    expect(
      suggestReactions({ content: 'Stuck — @user which region?', authorId: 'the-builder', memberIds: IDS }),
    ).toEqual([])
  })

  it('celebrates shipped work from the chain successor', () => {
    const [r] = suggestReactions({ content: 'Deployed ```js\nok\n```', authorId: 'the-builder', memberIds: IDS })
    expect(r.emoji).toBe('🎉')
    expect(r.byMemberId).toBe('the-tester')
  })

  it('supports failures instead of piling on', () => {
    const [r] = suggestReactions({ content: 'Blocking issue in auth', authorId: 'the-builder', memberIds: IDS })
    expect(r.emoji).toBe('🫡')
  })

  it('falls back to the reactor signature voice', () => {
    const [r] = suggestReactions({ content: 'Refinei o escopo aqui.', authorId: 'the-builder', memberIds: IDS })
    expect(['the-mediator', 'the-tester']).toContain(r.byMemberId)
    expect(r.emoji).toBe(SIGNATURE_EMOJI[r.byMemberId])
  })

  it('ignores empty content and solo rooms', () => {
    expect(suggestReactions({ content: '   ', authorId: 'the-builder', memberIds: IDS })).toEqual([])
    expect(suggestReactions({ content: 'hi', authorId: 'the-builder', memberIds: ['the-builder'] })).toEqual([])
  })
})

describe('toggleReaction', () => {
  it('adds and removes the user emoji', () => {
    const added = toggleReaction([], '👍', 'user')
    expect(added).toEqual([{ emoji: '👍', byMemberId: 'user' }])
    expect(toggleReaction(added, '👍', 'user')).toEqual([])
  })

  it('keeps agent reactions when the user toggles the same emoji', () => {
    const base = [{ emoji: '👍', byMemberId: 'the-builder' }]
    const added = toggleReaction(base, '👍', 'user')
    expect(added).toHaveLength(2)
    expect(toggleReaction(added, '👍', 'user')).toEqual(base)
  })

  it('offers a quick picker set', () => {
    expect(QUICK_EMOJI).toContain('👍')
    expect(QUICK_EMOJI.length).toBeGreaterThan(4)
  })

  it('ignores pings and slash commands', () => {
    expect(suggestReactions({ content: '...', authorId: 'the-builder', memberIds: IDS })).toEqual([])
    expect(suggestReactions({ content: '/summarize', authorId: 'the-builder', memberIds: IDS })).toEqual([])
  })
})

describe('reactionThreadLines', () => {
  it('mirrors a reaction as a tiny user-role line', () => {
    const lines = reactionThreadLines('Deployed ```js\nok\n```', 'the-builder', IDS)
    expect(lines).toHaveLength(1)
    expect(lines[0].role).toBe('user')
    expect(lines[0].content).toContain('[reaction]')
    expect(lines[0].content).toContain('the-tester')
    expect(lines[0].content).toContain('🎉')
  })

  it('stays silent on blocking questions', () => {
    expect(reactionThreadLines('Stuck — @user which region?', 'the-builder', IDS)).toEqual([])
  })
})

describe('appendThreadWithReactionCap', () => {
  it('appends reaction lines after the turn', () => {
    const thread = [{ role: 'user' as const, content: 'goal' }]
    const next = appendThreadWithReactionCap(thread, reactionThreadLines('Done', 'the-builder', IDS))
    expect(next).toHaveLength(2)
    expect(next[1].content).toContain('[reaction]')
  })

  it('caps reaction lines at 40, dropping the oldest', () => {
    const thread = [{ role: 'user' as const, content: 'goal' }]
    let next = thread
    for (let i = 0; i < 45; i++) {
      next = appendThreadWithReactionCap(next, [
        { role: 'user' as const, content: `[reaction] the-tester reacted 👍 #${i}` },
      ])
    }
    const reactionLines = next.filter((m) => m.content.startsWith('[reaction]'))
    expect(reactionLines).toHaveLength(40)
    expect(reactionLines[0].content).toContain('#5')
    expect(reactionLines[39].content).toContain('#44')
  })
})
