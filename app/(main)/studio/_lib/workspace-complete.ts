import { WORKSPACE_COMMANDS } from './workspace-commands'

export type CompletionKind = 'command' | 'mention'
export type Completion = { value: string; label: string; kind: CompletionKind }

// Active token = trailing / or @ word (start or after whitespace), so mid-word
// emails like foo@bar.com never trigger suggestions. Case-insensitive:
// typing @BUI still completes @the-builder.
const TOKEN_RE = /(?:^|\s)([/@])([a-z-]*)$/i

export function getCompletions(input: string, memberIds: string[]): Completion[] {
  const m = input.match(TOKEN_RE)
  if (!m) return []
  const sigil = m[1]
  const prefix = m[2].toLowerCase()
  if (sigil === '/') {
    return WORKSPACE_COMMANDS.filter((c) => c.startsWith(prefix)).map((c) => ({
      value: `/${c}`,
      label: `/${c}`,
      kind: 'command' as const,
    }))
  }
  const pool = [...memberIds, 'user']
  return pool
    .filter((id) => {
      if (prefix === '') return true
      const short = id.startsWith('the-') ? id.slice(4) : id
      return id.startsWith(prefix) || short.startsWith(prefix)
    })
    .map((id) => ({
      value: id === 'user' ? '@user' : `@${id}`,
      label: id === 'user' ? '@user — ask me (HITL)' : `@${id}`,
      kind: 'mention' as const,
    }))
}

export function applyCompletion(input: string, value: string): string {
  return input.replace(/(?:^|\s)[/@][a-z-]*$/i, (m) => {
    const lead = m.startsWith(' ') || m.startsWith('\t') ? m[0] : ''
    return `${lead}${value} `
  })
}
