// `@` mentions for direct member routing. Pure parse only — execution
// calls runTurn(target) with the mediator skipped (confidence 100).

export type ParsedMentions = {
  targets: string[]
  cleanText: string
  userMention: boolean
  skipsMediator: boolean
  error?: string
}

export function parseMentions(input: string, validIds: string[]): ParsedMentions {
  const empty = { targets: [], cleanText: input.trim(), userMention: false, skipsMediator: false }
  // `@` must start the input or follow whitespace — otherwise addresses
  // like foo@bar.com would false-positive as member mentions.
  const re = /(?:^|\s)@([a-z][a-z0-9-]*)/g
  const rawTokens: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) rawTokens.push(m[1].toLowerCase())
  if (rawTokens.length === 0) return empty

  const userMention = rawTokens.includes('user')
  const targets: string[] = []
  for (const tok of rawTokens) {
    if (tok === 'user') continue
    const full = tok.startsWith('the-') ? tok : `the-${tok}`
    if (!validIds.includes(full)) {
      return { ...empty, userMention, error: `unknown member @${tok} — not in this workspace` }
    }
    if (!targets.includes(full)) targets.push(full)
  }
  // Strip only member tokens, keep the rest as the delegated prompt.
  const cleanText = input
    .replace(/(?:^|\s)@(the-[a-z-]+|[a-z][a-z0-9-]*)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { targets, cleanText, userMention, skipsMediator: targets.length > 0 }
}
