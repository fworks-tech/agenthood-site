import { describe, it, expect } from 'vitest'
import { collectMemberData } from '../scripts/sync-skills.mjs'

const skill = (body) => `---\nallowed-tools: code.write\n---\n# Title\n\n## When to Use\n${body}\n`

describe('sync-skills', () => {
  it('rejects when a member fetch fails instead of emitting empty generated data', async () => {
    const fetchMember = (name) =>
      name === 'the-tester'
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(skill('- one'))

    await expect(collectMemberData(fetchMember)).rejects.toThrow('network down')
  })

  it('keeps the success path: strips frontmatter, extracts prompts and flags code agents', async () => {
    const { skills, prompts, codeAgents } = await collectMemberData(() =>
      Promise.resolve(skill('- one\n- two')),
    )

    expect(Object.keys(skills)).toHaveLength(20)
    expect(skills['the-architect']).toContain('# Title')
    expect(skills['the-architect']).not.toContain('allowed-tools')
    expect(prompts['the-architect']).toEqual(['one', 'two'])
    expect(codeAgents).toContain('the-architect')
  })
})
