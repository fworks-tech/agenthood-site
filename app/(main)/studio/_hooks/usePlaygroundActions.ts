'use client'

import { useCallback } from 'react'
import { track } from '@vercel/analytics'
import type { AgentEntry } from '../_data/agents'
import type { ChatConfig } from '../_types/studio'
import { DEMO_MODEL, DEMO_PROVIDER } from '../_types/studio'
import { agentSkills } from '../_data/agents.generated'
import { buildSystemPrompt } from '../_lib/system-prompt'
import type { LogLevel, LogCategory } from '../_lib/log-types'
import type { useStudioChat } from './useStudioChat'

type Chat = ReturnType<typeof useStudioChat>

interface UsePlaygroundActionsOptions {
  chat: Pick<Chat, 'newConversation' | 'deleteConversation' | 'isStreaming' | 'abortStream'>
  selectedAgent: AgentEntry | null
  setConfig: React.Dispatch<React.SetStateAction<ChatConfig>>
  configOpen: boolean
  setConfigOpen: React.Dispatch<React.SetStateAction<boolean>>
  configStorageKey: string
  defaultSystemPrompt: string
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void
}

export function usePlaygroundActions(options: UsePlaygroundActionsOptions) {
  const { chat, selectedAgent, setConfig, configOpen, setConfigOpen, configStorageKey, defaultSystemPrompt, addLog } = options

  const handleSaveConfig = useCallback(
    (cfg: ChatConfig) => {
      try {
        sessionStorage.setItem(configStorageKey, JSON.stringify({ ...cfg, apiKey: undefined }))
        addLog('info', 'Configuration saved locally')
      } catch {
        addLog('error', 'Failed to save configuration')
      }
    },
    [configStorageKey, addLog],
  )

  const handleSelectAgent = useCallback(
    (agent: AgentEntry) => {
      const agentConfig = { systemPrompt: buildSystemPrompt(agent.id) || agentSkills[agent.id] || defaultSystemPrompt }
      setConfig((prev) => ({ ...prev, ...agentConfig }))
      chat.newConversation(agent.id, agentConfig)
      addLog('info', `Selected: ${agent.icon ?? ''} ${agent.name} · ${agent.role} · ${DEMO_PROVIDER}/${DEMO_MODEL}`)
      track('agent_selected', { agentId: agent.id, provider: DEMO_PROVIDER, model: DEMO_MODEL })
      if (!configOpen && window.innerWidth >= 768) setConfigOpen(true)
    },
    [chat, addLog, configOpen, defaultSystemPrompt, setConfig, setConfigOpen],
  )

  const handleNewConversation = useCallback(() => {
    if (selectedAgent) {
      chat.newConversation(selectedAgent.id)
      addLog('info', `New conversation with ${selectedAgent.name}`)
      track('conversation_created', { agentId: selectedAgent.id })
    }
  }, [chat, selectedAgent, addLog])

  const handleDeleteConversation = useCallback(
    (id: string) => {
      track('conversation_deleted', { agentId: selectedAgent?.id ?? 'unknown', conversationId: id })
      chat.deleteConversation(id)
    },
    [chat, selectedAgent?.id],
  )

  const handleAbortStream = useCallback(() => {
    if (chat.isStreaming && selectedAgent) {
      addLog('warn', '⏹ Streaming cancelled by user')
    }
    chat.abortStream()
  }, [chat, selectedAgent, addLog])

  return {
    handleSaveConfig,
    handleSelectAgent,
    handleNewConversation,
    handleDeleteConversation,
    handleAbortStream,
  }
}
