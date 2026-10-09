import { describe, it, expect } from 'vitest'
import {
  toPolished,
  isEmptyTurn,
  collapseFraming,
  mentionsUser,
  collapseIntermediates,
} from '../app/(main)/studio/_lib/workspace-polish'

describe('toPolished', () => {
  it('passes through normal prose', () => {
    expect(toPolished('## Heading\nSome **bold** text.')).toBe('## Heading\nSome **bold** text.')
  })

  it('strips [tool_call:] lines', () => {
    const raw = '[tool_call: web_fetch(url=https://x)]\nReal answer here'
    expect(toPolished(raw)).toBe('Real answer here')
  })

  it('strips [tool_result:] lines', () => {
    const raw = '[tool_result: some html]\nReal answer here'
    expect(toPolished(raw)).toBe('Real answer here')
  })

  it('strips Max tool iterations line', () => {
    const raw = 'Max tool iterations reached.\nReal answer here'
    expect(toPolished(raw)).toBe('Real answer here')
  })

  it('hides a pure mediator JSON plan', () => {
    const raw = JSON.stringify({ members: [{ id: 'the-builder', task: 'x', order: 0 }] })
    expect(toPolished(raw)).toBe('')
  })

  it('strips JSON plan embedded in prose but keeps the prose', () => {
    const plan = JSON.stringify({ members: [{ id: 'the-builder', task: 'x', order: 0 }] })
    const raw = `Here is the plan: ${plan}`
    expect(toPolished(raw)).toBe('Here is the plan:')
  })

  it('collapses runs of blank lines', () => {
    expect(toPolished('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('returns empty for empty input', () => {
    expect(toPolished('')).toBe('')
    expect(toPolished('   ')).toBe('')
  })

  it('keeps json that is not a mediator plan', () => {
    expect(toPolished('{"foo":1}')).toBe('{"foo":1}')
  })
})

describe('collapseFraming', () => {
  it('passes through prose with no machinery', () => {
    const t = 'Ship it once CI is green.\nI checked the logs already.'
    expect(collapseFraming(t)).toBe(t)
  })

  it('never trims a code-bearing answer', () => {
    const t = 'Here is the fix:\n```ts\nconst a = 1\n```\nI will route it next.'
    expect(collapseFraming(t)).toBe(t)
  })

  it('leaves long substantive answers untouched', () => {
    const body =
      'The migration plan is safe. ' +
      'Each step is reversible and verified against the routing record and the first desk notes. '.repeat(
        18
      )
    expect(body.length).toBeGreaterThan(1200)
    expect(collapseFraming(body)).toBe(body)
  })

  it('collapses a pure greeting menu down to the @user question', () => {
    const raw = [
      "Morning. I'm the first desk in this room — nothing gets to a specialist until there's something real to classify.",
      'So: what are we doing?',
      '- A specific build, fix, or review — I hand it straight to the owner.',
      '- Something still fuzzy — I send it up the line to get the goal sharpened first.',
      "- A session that's already heavy on context — I get the load triaged before anyone else walks in.",
      "@user What's the ask?",
    ].join('\n')
    const out = collapseFraming(raw)
    expect(out).not.toMatch(/first desk|hand it straight|send it up the line|load triaged/)
    expect(out).toContain('@user')
  })

  it('drops the "only specialist / outside my lane" explanation but keeps the ask', () => {
    const raw = [
      'Standing by then. No rush.',
      'One thing worth knowing: in this room, the only specialist I can put you in front of is the-architect. If it lands in a build/debug/review lane, I flag that it belongs to a specialist outside my lane.',
      "@user Give me one sentence on what you want and I'll route it.",
    ].join('\n')
    const out = collapseFraming(raw)
    expect(out).not.toMatch(/only specialist|outside my lane|put you in front/)
    expect(out).toContain("@user Give me one sentence on what you want and I'll route it.")
  })

  it('removes routing-record narration and collapses to the question', () => {
    const raw = [
      "Nothing to classify yet, so nothing to route. I'm not going to invent an intent and hand you to a specialist on a greeting.",
      '- If it is still forming, say so; I will pass it to the-architect to spec it out before anything gets built.',
      "- I don't write the routing record until there's a real prompt behind it.",
      '@user What do you actually want done here?',
    ].join('\n')
    expect(collapseFraming(raw)).toBe('@user What do you actually want done here?')
  })

  it('is applied inside toPolished', () => {
    const raw = "I'm the first desk in this room.\n@user What's the task?"
    expect(toPolished(raw)).toBe("@user What's the task?")
  })
})

describe('isEmptyTurn', () => {
  it('flags empty output', () => {
    expect(isEmptyTurn('')).toBe(true)
    expect(isEmptyTurn('   ')).toBe(true)
  })

  it('flags dots-only output that survives polishing', () => {
    expect(isEmptyTurn('...')).toBe(true)
    expect(isEmptyTurn('…')).toBe(true)
    expect(isEmptyTurn('... The Builder is thinking...')).toBe(false)
  })

  it('flags thinking-only preambles', () => {
    expect(isEmptyTurn('Let me check the repo first')).toBe(true)
  })

  it('keeps real answers', () => {
    expect(isEmptyTurn('## Plan\n- item one with enough detail to count as useful')).toBe(false)
    expect(isEmptyTurn('{"foo":1}')).toBe(false)
  })
})

describe('mentionsUser', () => {
  it('detects an @user address', () => {
    expect(mentionsUser("@user What's the ask?")).toBe(true)
    expect(mentionsUser('Some prose.\n@user tell me more')).toBe(true)
  })
  it('ignores emails and member accessors', () => {
    expect(mentionsUser('contact a@user.com')).toBe(false)
    expect(mentionsUser('obj.@user.route')).toBe(false)
    expect(mentionsUser('no address here')).toBe(false)
  })
})

describe('collapseIntermediates', () => {
  const msg = (memberId: string, content: string) => ({ memberId, content })

  it('does nothing when the thread is at or under the threshold', () => {
    const list = [msg('user', 'hi'), msg('the-mediator', 'Let me check'), msg('user', 'yo')]
    const { visible, hidden } = collapseIntermediates(list)
    expect(hidden).toEqual([])
    expect(visible).toHaveLength(3)
  })

  it('keeps a short @user reply past the threshold instead of hiding it (#316)', () => {
    const list = [
      msg('user', 'hi'),
      msg('the-mediator', "@user What's the ask?"),
      msg('user', 'sup'),
      msg('the-mediator', 'Let me check the repo and see'),
      msg('user', 'x'),
      msg('user', 'y'),
      msg('user', 'z'),
      msg('the-reviewer', '@user Should I merge?'),
    ]
    const { visible, hidden } = collapseIntermediates(list)
    expect(visible).toContainEqual(msg('the-mediator', "@user What's the ask?"))
    expect(hidden).toContainEqual(msg('the-mediator', 'Let me check the repo and see'))
  })

  it('always keeps every user bubble', () => {
    const list = [
      msg('user', 'a'),
      msg('the-builder', 'Let me think about this for a bit'),
      msg('user', 'b'),
      msg('the-builder', 'Now let me consider the options'),
      msg('user', 'c'),
      msg('user', 'd'),
      msg('user', 'e'),
      msg('the-auditor', 'Checked, all clear on the security front'),
    ]
    const { visible } = collapseIntermediates(list)
    expect(list.filter((m) => m.memberId === 'user').every((m) => visible.includes(m))).toBe(true)
  })
})