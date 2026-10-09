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
  return collapseFraming(out)
}

// Members sometimes narrate their role and routing process instead of just
// answering ("I'm the first desk…", "the only specialist I can put you in
// front of…", "I don't write the routing record…"). Drop those framing lines
// from the polished view. If what remains is only the @user question, collapse
// to that question alone. Code-bearing answers are never touched.
const MACHINERY =
  /first desk|nothing gets to a|to a specialist until|the only specialist|i can put you in front|outside my lane|i'?ll (classify|route|pass|hand|send|get the)|hand it straight|send it up the line|load triaged|i don'?t (write|route)|routing record|nothing to classify|invent an intent|classify and tell|before anyone else walks in|i'?m (a |the )?(desk|gatekeeper|router|triage)|i'?ll hand this up/i

export function collapseFraming(text: string): string {
  if (text.includes('```')) return text
  // Long replies are substantive answers, not greeting/menu dumps — leave them.
  if (text.length > 1200) return text
  const lines = text.split('\n')
  // @user question lines are never framing, even if they contain "I'll route…".
  const isFraming = (l: string) => !l.includes('@user') && MACHINERY.test(l)
  if (!lines.some(isFraming)) return text
  const kept = lines.filter((l) => !isFraming(l))
  const content = kept.map((l) => l.trim()).filter(Boolean)
  const asks = content.filter((l) => l.includes('@user'))
  if (asks.length && content.length === asks.length) return asks[asks.length - 1]
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
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

/** A turn with nothing routable: empty, dots-only, or thinking-only preamble.
 *  Bare "..." survives toPolished and matches no thinking prefix, so it gets
 *  its own check — otherwise it reads as conversation downstream. */
export function isEmptyTurn(raw: string): boolean {
  const polished = toPolished(raw).trim()
  if (!polished) return true
  if (/^[.…\s]+$/.test(polished)) return true
  return isThinkingOnly(polished)
}
/** A message is "useful" when it contains an actual answer for the user
 *  (not just a thinking preamble). Heuristic: contains a code block,
 *  a markdown heading/list with substantial body, or is long and not
 *  a single "Let me ..." sentence. */
export function isUsefulPolished(polished: string): boolean {
  const t = polished.trim()
  if (!t) return false
  if (t.includes('```')) return true
  // Long form answer with structure is considered useful even without code
  if (t.length > 800) return true
  if (t.length > 400 && (t.includes('##') || t.includes('###') || t.includes('- '))) return true
  // Explicit thinking-only patterns are never useful on their own
  if (isThinkingOnly(polished)) return false
  // Medium length prose that is not just thinking can be useful
  if (t.length > 300 && !t.startsWith('Let me ') && !t.startsWith('Now let me')) return true
  return false
}

export function isThinkingOnly(polished: string): boolean {
  const t = polished.trim()
  if (!t) return false
  if (t.includes('```')) return false
  if (t.length > 500) return false
  // Common LLM preamble before tool use
  const thinkingPrefixes = [
    'Let me ',
    'Now let me ',
    'I need to ',
    'I will ',
    "I'll ",
    'Let me verify',
    'Let me look',
    'Let me check',
  ]
  return thinkingPrefixes.some((p) => t.startsWith(p))
}