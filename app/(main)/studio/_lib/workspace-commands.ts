// Local `/` commands for the workspace composer. Pure parse only —
// execution lives in the page/useWorkspace layer. Unknown `/` never hits LLM.

export const WORKSPACE_COMMANDS = [
  'summarize',
  'continue',
  'retry',
  'stop',
  'new',
  'help',
  'plan',
] as const

export type WorkspaceCommandName = (typeof WORKSPACE_COMMANDS)[number]

export type ParsedCommand = { name: WorkspaceCommandName; args: string } | { name: string; args: string; unknown: true }

export function parseWorkspaceCommand(input: string): ParsedCommand | null {
  const t = input.trim()
  if (!t.startsWith('/')) return null
  const space = t.indexOf(' ')
  const raw = (space === -1 ? t.slice(1) : t.slice(1, space)).toLowerCase()
  const args = (space === -1 ? '' : t.slice(space + 1)).trim()
  if ((WORKSPACE_COMMANDS as readonly string[]).includes(raw)) {
    return { name: raw as WorkspaceCommandName, args }
  }
  return { name: raw || '/', args, unknown: true }
}

// A message with no content to route: empty or only dots/ellipsis. These burn
// a full round-trip today and read as "mid-thought" to members — answer inline.
export function isEmptyPing(input: string): boolean {
  const t = input.trim()
  if (!t) return true
  return /^[.…\s]+$/.test(t)
}
