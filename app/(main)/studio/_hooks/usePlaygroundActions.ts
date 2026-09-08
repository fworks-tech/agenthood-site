'use client'

import { useCallback } from 'react'
import { track } from '@vercel/analytics'
import type { AgentEntry } from '../_data/agents'
import type { ChatConfig, Provider } from '../_types/studio'
import { getDefaultModel, getProviderMeta } from '../_types/studio'
import { agentSkills } from '../_data/agents.generated'
import type { LogLevel, LogCategory } from '../_lib/log-types'
import type { useStudioChat } from './useStudioChat'

type Chat = ReturnType<typeof useStudioChat>

interface UsePlaygroundActionsOptions {
  chat: Pick<Chat, 'newConversation' | 'deleteConversation' | 'isStreaming' | 'abortStream'>
  selectedAgent: AgentEntry | null
  config: Pick<ChatConfig, 'provider' | 'model'>
  setConfig: React.Dispatch<React.SetStateAction<ChatConfig>>
  configOpen: boolean
  setConfigOpen: React.Dispatch<React.SetStateAction<boolean>>
  configStorageKey: string
  defaultSystemPrompt: string
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void
}

export function usePlaygroundActions(options: UsePlaygroundActionsOptions) {
  const { chat, selectedAgent, config, setConfig, configOpen, setConfigOpen, configStorageKey, defaultSystemPrompt, addLog } = options

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
      const provider: Provider = 'opencode-go'
      const model = getDefaultModel(provider)
      const prompt = agentSkills[agent.id] ?? defaultSystemPrompt
      const agentConfig = {
        provider,
        model,
        baseUrl: getProviderMeta(provider).defaultBaseUrl,
        systemPrompt: prompt,
      }
      setConfig((prev) => ({ ...prev, ...agentConfig }))
      chat.newConversation(agent.id, agentConfig)
      addLog('info', `Selected: ${agent.icon ?? ''} ${agent.name} · ${agent.role} · ${provider}/${model}`)
      track('agent_selected', { agentId: agent.id, provider, model })
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

  const handleConfigChange = useCallback(
    (newConfig: ChatConfig) => {
      if (newConfig.provider !== config.provider || newConfig.model !== config.model) {
        addLog('info', `Config: ${newConfig.provider} · ${newConfig.model}`)
        track('config_changed', {
          provider: newConfig.provider,
          model: newConfig.model,
          temperature: newConfig.temperature,
          maxTokens: newConfig.maxTokens,
        })
      }
      setConfig(newConfig)
    },
    [config.provider, config.model, addLog, setConfig],
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
    handleConfigChange,
    handleAbortStream,
  }
}
