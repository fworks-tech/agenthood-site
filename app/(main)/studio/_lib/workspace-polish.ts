// Shared "polish" logic: the chat should only show the final polished answer,
// never raw tool markers, routing JSON, or technical one-liners. Those belong
// in the per-message "View logs" dialog. This single helper keeps the thread
// (sent to the next member) and the rendered card in agreement.
export function toPolished(content: string): string {
  const raw = content.trim()

  // Mediator JSON routing plan — hide from polished view entirely.
  if (looksLikeMediatorPlan(raw)) return ''

  // Strip a JSON plan embedded in prose (e.g. "Here is the plan: {...}").
  const jsonCandidate = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
  if (jsonCandidate.includes('"members"') && looksLikeMediatorPlan(jsonCandidate)) {
    const rest = raw.replace(jsonCandidate, '').trim()
    return rest || ''
  }

  const lines = content.split('\n')
  const filtered = lines.filter((l) => {
    const t = l.trim()
    if (!t) return true
    if (t.startsWith('[tool_call:')) return false
    if (t.startsWith('[tool_result:')) return false
    if (t.startsWith('Max tool iterations reached')) return false
    if (t.startsWith('{"members"')) return false
    return true
  })
  const out = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (looksLikeMediatorPlan(out)) return ''
  return out
}

function looksLikeMediatorPlan(text: string): boolean {
  if (!text.startsWith('{') || !text.includes('"members"')) return false
  try {
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    return Array.isArray(parsed?.members)
  } catch {
    return false
  }
}