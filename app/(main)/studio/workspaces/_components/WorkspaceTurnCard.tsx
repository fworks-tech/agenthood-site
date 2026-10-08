'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Paper, Text, ActionIcon, Group, Title, Modal, Collapse, Badge } from '@mantine/core'
import { CodeHighlight } from '@mantine/code-highlight'
import { IconThumbUp, IconThumbDown, IconEye, IconCopy, IconCheck, IconMessageReply } from '@tabler/icons-react'
import { getAgentById } from '../../_data/agents'
import { QUICK_EMOJI } from '../../_lib/workspace-reactions'
import type { WorkspaceReaction } from '../../_types/workspace'
import { STORAGE_KEYS } from '../../_lib/constants'
import { childrenToString } from '../../../../_lib/react-children'
import { isThinkingOnly, isUsefulPolished, toPolished } from '../../_lib/workspace-polish'
import type { WorkspaceToolCall } from '../../_hooks/useWorkspace'

interface Props {
  memberId: string
  content: string
  turnIndex: number
  toolCalls?: WorkspaceToolCall[]
  reactions?: WorkspaceReaction[]
  onReact?: (emoji: string) => void
  onReply?: (memberId: string) => void
}

// Group-chat accent per agent lane — full literal class strings so the
// Tailwind scanner keeps them. Avatar carries the fantasy (icon on lane
// color), the edge marks every follow-up bubble of the same turn.
// NOTE: always use full literal strings (`'bg-indigo-500/15'`), never
// compose them dynamically (`'bg-' + color + '-500/15'`) — the Tailwind
// content scanner cannot find dynamically composed class names.
export function agentAccent(category?: string) {
  switch (category) {
    case 'engineering':
      return { avatar: 'bg-indigo-500/15 text-indigo-200', dot: 'bg-indigo-400', edge: 'border-l-indigo-500/70' }
    case 'validation':
      return { avatar: 'bg-amber-500/15 text-amber-200', dot: 'bg-amber-400', edge: 'border-l-amber-500/70' }
    case 'knowledge':
      return { avatar: 'bg-violet-500/15 text-violet-200', dot: 'bg-violet-400', edge: 'border-l-violet-500/70' }
    case 'lifecycle':
      return { avatar: 'bg-emerald-500/15 text-emerald-200', dot: 'bg-emerald-400', edge: 'border-l-emerald-500/70' }
    default:
      return { avatar: 'bg-zinc-500/15 text-zinc-200', dot: 'bg-zinc-400', edge: 'border-l-zinc-500/60' }
  }
}

function summarizeArgs(tc: WorkspaceToolCall): string {
  const url = (tc.args as Record<string, unknown>)?.url
  if (typeof url === 'string' && url) {
    try {
      const u = new URL(url)
      return (u.hostname + u.pathname).slice(0, 60)
    } catch {
      return String(url).slice(0, 60)
    }
  }
  const code = (tc.args as Record<string, unknown>)?.code
  if (typeof code === 'string' && code) return String(code).slice(0, 50)
  try {
    return JSON.stringify(tc.args).slice(0, 60)
  } catch {
    return ''
  }
}

function reactorName(byMemberId: string): string {
  if (byMemberId === 'user') return 'você'
  return getAgentById(byMemberId)?.name ?? byMemberId
}

function ReactionRow({
  reactions,
  onReact,
  align,
}: {
  reactions?: WorkspaceReaction[]
  onReact?: (emoji: string) => void
  align: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  if (!onReact && (!reactions || reactions.length === 0)) return null
  const grouped = new Map<string, string[]>()
  for (const r of reactions ?? []) grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.byMemberId])
  return (
    <div className={`flex flex-wrap items-center gap-1 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {[...grouped.entries()].map(([emoji, by]) => {
        const mine = by.includes('user')
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact?.(emoji)}
            title={by.map(reactorName).join(', ')}
            className={`react-pop cursor-pointer rounded-full border px-2 py-0.5 text-xs transition-transform hover:scale-110 active:scale-95 ${
              mine
                ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-100'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            <span>{emoji}</span>
            {by.length > 1 && <span className="ml-1 font-semibold">{by.length}</span>}
          </button>
        )
      })}
      {onReact && (
        <span className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Reagir"
            className="cursor-pointer rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 transition-transform hover:scale-110 active:scale-95"
          >
            ☺ +
          </button>
          {open && (
            <span className="absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 shadow-xl">
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(e)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded-lg px-1.5 py-1 text-base transition-transform hover:scale-125 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95"
                >
                  {e}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function loadFeedback(): Record<string, 'up' | 'down'> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.FEEDBACK) ?? '{}')
  } catch {
    return {}
  }
}

function saveFeedback(id: string, value: 'up' | 'down') {
  const fb = loadFeedback()
  fb[id] = value
  localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(fb))
}

async function submitFeedback(messageId: string, value: 'up' | 'down' | null) {
  if (value) saveFeedback(messageId, value)
  try {
    await fetch('/api/studio/feedback/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, value }),
    })
  } catch (err) {
    console.warn('Feedback submission failed', err)
  }
}

export default function WorkspaceTurnCard({ memberId, content, turnIndex, toolCalls, reactions, onReact, onReply }: Props) {
  const agent = getAgentById(memberId)
  const isUser = memberId === 'user'
  const polished = toPolished(content)
  const thinkingOnly = isThinkingOnly(polished)
  const useful = isUsefulPolished(polished)
  const hasLogs = (toolCalls && toolCalls.length > 0) || (!polished && !!content)
  const mentionsUser = /(^|[^\w.-])@user\b/i.test(polished)

  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  // turnIndex is a monotonic session counter, so memberId+turnIndex is a stable unique id
  const messageId = `${memberId}-${turnIndex}`

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback(loadFeedback()[messageId] ?? null)
  }, [messageId])

  // Hide empty mediator routing messages entirely — they are technical
  if (memberId === 'the-mediator' && !polished) return null
  // Synthesis disabled — legacy synthesizer cards never render.
  if (memberId === 'synthesizer') return null

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">You</span>
        <div className="msg-in max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-indigo-700 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-indigo-950/30">
          <span className="break-words whitespace-pre-wrap">{content}</span>
        </div>
        <ReactionRow reactions={reactions} onReact={onReact} align="end" />
      </div>
    )
  }

  const accent = agentAccent(agent?.category)
  const actions = toolCalls ?? []
  const showThinking = thinkingOnly || (!polished && !content)

  const mdComponents: Components = {
    // code_execution results showed 120+ char lines overflowing the Paper;
    // CodeHighlight wraps long lines and collapses tall blocks to keep threads scannable
    pre: ({ children }) => (
      <CodeHighlight
        code={childrenToString(children)}
        language="tsx"
        withCopyButton
        withExpandButton
        maxCollapsedHeight={420}
        withBorder
      />
    ),
    code: ({ children, className }) => {
      const isBlock = !!className
      return isBlock ? (
        <code className={className}>{children}</code>
      ) : (
        <code className="rounded bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 text-xs break-words [overflow-wrap:anywhere]">{children}</code>
      )
    },
    h1: ({ children }) => (
      <Title order={3} size="sm" fw={600} mt="sm" mb={4}>
        {children}
      </Title>
    ),
    h2: ({ children }) => (
      <Title order={4} size="sm" fw={600} mt="sm" mb={4}>
        {children}
      </Title>
    ),
    h3: ({ children }) => (
      <Title order={5} size="sm" fw={600} mt="sm" mb={4}>
        {children}
      </Title>
    ),
    strong: ({ children }) => <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{children}</strong>,
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
        {children}
      </a>
    ),
  }

  const isLong = !thinkingOnly && !!polished && (polished.length > 2200 || polished.split('\n').length > 50)
  const showToggle = isLong && useful
  const clamped = showToggle && !expanded

  return (
    <>
      <div className="flex items-start justify-start gap-2.5">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${accent.avatar}`} title={agent?.role ?? memberId}>
          {agent?.icon ?? '•'}
        </span>
        <div className="min-w-0 max-w-[85%] space-y-1.5 md:max-w-[75%]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{agent?.name ?? memberId}</span>
            {agent?.role && (
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{agent.role}</span>
            )}
            <Badge size="xs" variant="light" color="gray" className="uppercase tracking-wide">
              {`turn ${turnIndex}`}
            </Badge>
            <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} title={memberId} />
          </div>

          {actions.map((tc, ix) => {
            const running = tc.status === 'running'
            const failed = tc.status === 'error'
            return (
              <button
                key={tc.id}
                type="button"
                onClick={() => setLogsOpen(true)}
                title="View action details"
                style={{ animationDelay: `${Math.min(ix * 70, 280)}ms` }}
                className={`action-pop flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-2xl rounded-tl-md border border-dashed px-3 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80 ${
                  failed
                    ? 'border-red-800/50 bg-red-950/20 text-red-300'
                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${failed ? 'bg-red-400' : running ? 'animate-pulse bg-zinc-400' : 'bg-emerald-400'}`} />
                <span className="shrink-0 font-medium">
                  {running ? `using ${tc.name}…` : failed ? `failed ${tc.name}` : `used ${tc.name}`}
                </span>
                <span className="truncate font-mono text-[11px] opacity-70">{summarizeArgs(tc)}</span>
              </button>
            )
          })}

          {showThinking ? (
            <div className="msg-in w-fit rounded-2xl rounded-tl-md border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '300ms' }} />
                </span>
                {thinkingOnly ? (polished ? polished.slice(0, 90) : 'thinking…') : `${agent?.name ?? memberId} is typing…`}
              </span>
            </div>
          ) : (
            <Paper
              bg="zinc.9"
              px="xl"
              py={10}
              className={`msg-in border-l-2 ${accent.edge} transition-all duration-300 hover:shadow-xl hover:shadow-black/20 ${mentionsUser ? 'ring-1 ring-amber-500/40 bg-amber-500/5' : ''}`}
            >
              <div className={`break-words text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 ${clamped ? 'relative max-h-[520px] overflow-hidden' : ''}`}>
                {polished ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {polished}
                  </ReactMarkdown>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {toPolished(content) || '_No polished output — see logs_'}
                  </ReactMarkdown>
                )}
                {clamped && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-100 dark:from-[rgb(24,24,27)] to-transparent" />}
              </div>
              {showToggle && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-3 cursor-pointer text-xs font-medium text-indigo-400 transition-all duration-200 hover:text-indigo-300 hover:scale-[1.02] active:scale-95"
                >
                  {expanded ? 'View less' : `View more — ${Math.ceil(polished.length / 1000)}k chars`}
                </button>
              )}
              {polished && !useful && (
                <Text c="dimmed" size="xs" mt={4} className="italic">
                  Working — gathering context before the final answer.
                </Text>
              )}

              <Group gap="xs" mt="sm" pt="sm" className="border-t border-zinc-200 dark:border-zinc-800">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color={feedback === 'up' ? 'emerald.4' : 'zinc.6'}
                  onClick={() => {
                    const val = feedback === 'up' ? null : 'up'
                    setFeedback(val)
                    submitFeedback(messageId, val)
                  }}
                  title="Helpful"
                >
                  <IconThumbUp size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color={feedback === 'down' ? 'red.4' : 'zinc.6'}
                  onClick={() => {
                    const val = feedback === 'down' ? null : 'down'
                    setFeedback(val)
                    submitFeedback(messageId, val)
                  }}
                  title="Not helpful"
                >
                  <IconThumbDown size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="zinc.6"
                  onClick={async () => {
                    await navigator.clipboard.writeText(polished || content)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1200)
                  }}
                  title="Copy"
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
                {hasLogs && (
                  <ActionIcon variant="subtle" size="sm" color="zinc.6" onClick={() => setLogsOpen(true)} title="View logs">
                    <IconEye size={14} />
                  </ActionIcon>
                )}
                {onReply && isUser === false && (
                  <ActionIcon variant="subtle" size="sm" color="zinc.6" onClick={() => onReply(memberId)} title="Reply">
                    <IconMessageReply size={14} />
                  </ActionIcon>
                )}
                {hasLogs && (
                  <Text size="xs" c="dimmed" className="ml-1">
                    {actions.length ? `${actions.length} actions` : 'View logs'}
                  </Text>
                )}
              </Group>
            </Paper>
          )}
          <ReactionRow reactions={reactions} onReact={onReact} align="start" />
        </div>
      </div>

      <Modal opened={logsOpen} onClose={() => setLogsOpen(false)} title="View logs" size="lg" centered>
        <div className="space-y-4">
          {actions.length > 0 ? (
            <div className="space-y-2">
              <Text size="sm" fw={600}>
                Tool calls
              </Text>
              {actions.map((tc) => {
                const isOpen = !!expandedTools[tc.id]
                const statusColor =
                  tc.status === 'complete'
                    ? 'border-emerald-800/40 bg-emerald-950/20'
                    : tc.status === 'error'
                      ? 'border-red-800/40 bg-red-950/20'
                        : 'border-zinc-300 dark:border-zinc-700 bg-zinc-200/40 dark:bg-zinc-800/40'
                const dot =
                  tc.status === 'complete' ? 'bg-emerald-400' : tc.status === 'error' ? 'bg-red-400' : 'bg-zinc-500 animate-pulse'
                return (
                  <div key={tc.id} className={`rounded border px-2 py-1.5 text-xs ${statusColor}`}>
                    <button
                      type="button"
                      onClick={() => setExpandedTools((s) => ({ ...s, [tc.id]: !isOpen }))}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{tc.name}</span>
                      <span className="truncate text-zinc-500">{summarizeArgs(tc)}</span>
                      <span className={`ml-auto shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    <Collapse expanded={isOpen}>
                      <div className="mt-2 space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">args</div>
                          <pre className="mt-1 overflow-x-auto rounded bg-zinc-50/70 dark:bg-zinc-950/70 p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </div>
                        {tc.result && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-emerald-400">result</div>
                            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-50/70 dark:bg-zinc-950/70 p-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                              {tc.result.slice(0, 4000)}
                            </pre>
                          </div>
                        )}
                        {tc.error && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-red-400">error</div>
                            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-50/70 dark:bg-zinc-950/70 p-2 text-[11px] text-red-700 dark:text-red-300">
                              {tc.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    </Collapse>
                  </div>
                )
              })}
            </div>
          ) : (
            <Text size="sm" c="dimmed">
              No tool calls for this turn.
            </Text>
          )}

          <div>
            <Text size="sm" fw={600} mb={4}>
              Polished content
            </Text>
            <div className="rounded bg-zinc-50/70 dark:bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {polished || '_empty_'}
              </ReactMarkdown>
            </div>
          </div>

          <div>
            <Text size="sm" fw={600} mb={4}>
              Raw content (debug)
            </Text>
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 dark:bg-zinc-950 p-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              {content.slice(0, 6000) || '(empty)'}
            </pre>
          </div>
        </div>
      </Modal>
    </>
  )
}
