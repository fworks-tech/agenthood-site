'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Paper, Text, ActionIcon, Group, Title, Modal, Collapse, Badge } from '@mantine/core'
import { IconThumbUp, IconThumbDown, IconEye, IconCopy, IconCheck } from '@tabler/icons-react'
import { getAgentById } from '../../_data/agents'
import { STORAGE_KEYS } from '../../_lib/constants'
import { toPolished } from '../../_lib/workspace-polish'
import type { WorkspaceToolCall } from '../../_hooks/useWorkspace'

interface Props {
  memberId: string
  content: string
  turnIndex: number
  toolCalls?: WorkspaceToolCall[]
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

export default function WorkspaceTurnCard({ memberId, content, turnIndex, toolCalls }: Props) {
  const agent = getAgentById(memberId)
  const isUser = memberId === 'user'
  const polished = toPolished(content)
  const hasLogs = (toolCalls && toolCalls.length > 0) || (!polished && !!content)

  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  // turnIndex is a monotonic session counter, so memberId+turnIndex is a stable unique id
  const messageId = `${memberId}-${turnIndex}`

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback(loadFeedback()[messageId] ?? null)
  }, [messageId])

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-indigo-600 px-4 py-3 text-sm text-white">{content}</div>
      </div>
    )
  }

  const mdComponents: Components = {
    pre: ({ children }) => (
      <pre className="my-2 max-w-full overflow-x-auto rounded bg-zinc-950/70 p-2 text-xs leading-relaxed">{children}</pre>
    ),
    code: ({ children }) => (
      <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">{children}</code>
    ),
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
    strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
        {children}
      </a>
    ),
  }

  return (
    <>
      <Paper bg="zinc.9" px="xl" py={10} className="max-w-[85%] md:max-w-[75%]">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-base">{agent?.icon ?? '•'}</span>
          <span className="text-sm font-semibold text-zinc-100">{agent?.name ?? memberId}</span>
          <Badge size="xs" variant="light" color="gray" className="uppercase tracking-wide">
            turn {turnIndex}
          </Badge>
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-indigo-500" title={memberId} />
        </div>

        <div className="break-words text-sm leading-relaxed text-zinc-200">
          {polished ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {polished}
            </ReactMarkdown>
          ) : content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {toPolished(content) || '_No polished output — see logs_'}
            </ReactMarkdown>
          ) : (
            <Text c="dimmed" size="sm">
              Thinking...
            </Text>
          )}
        </div>

        <Group gap="xs" mt="sm" pt="sm" className="border-t border-zinc-800">
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
          {hasLogs && (
            <Text size="xs" c="dimmed" className="ml-1">
              {toolCalls?.length ? `${toolCalls.length} tool calls` : 'View logs'}
            </Text>
          )}
        </Group>
      </Paper>

      <Modal opened={logsOpen} onClose={() => setLogsOpen(false)} title="View logs" size="lg" centered>
        <div className="space-y-4">
          {toolCalls && toolCalls.length > 0 ? (
            <div className="space-y-2">
              <Text size="sm" fw={600}>
                Tool calls
              </Text>
              {toolCalls.map((tc) => {
                const isOpen = !!expandedTools[tc.id]
                const statusColor =
                  tc.status === 'complete'
                    ? 'border-emerald-800/40 bg-emerald-950/20'
                    : tc.status === 'error'
                      ? 'border-red-800/40 bg-red-950/20'
                      : 'border-zinc-700 bg-zinc-800/40'
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
                      <span className="font-medium text-zinc-200">{tc.name}</span>
                      <span className="truncate text-zinc-500">
                        {tc.args?.url
                          ? String(tc.args.url).slice(0, 80)
                          : tc.args?.code
                            ? String(tc.args.code).slice(0, 50)
                            : JSON.stringify(tc.args).slice(0, 80)}
                      </span>
                      <span className={`ml-auto shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    <Collapse expanded={isOpen}>
                      <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">args</div>
                          <pre className="mt-1 overflow-x-auto rounded bg-zinc-950/70 p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </div>
                        {tc.result && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-emerald-400">result</div>
                            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-950/70 p-2 text-[11px] text-zinc-300">
                              {tc.result.slice(0, 4000)}
                            </pre>
                          </div>
                        )}
                        {tc.error && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-red-400">error</div>
                            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-950/70 p-2 text-[11px] text-red-300">
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
            <div className="rounded bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {polished || '_empty_'}
              </ReactMarkdown>
            </div>
          </div>

          <div>
            <Text size="sm" fw={600} mb={4}>
              Raw content (debug)
            </Text>
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 text-[11px] text-zinc-400">
              {content.slice(0, 6000) || '(empty)'}
            </pre>
          </div>
        </div>
      </Modal>
    </>
  )
}
