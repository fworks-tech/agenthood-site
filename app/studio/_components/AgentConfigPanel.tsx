"use client";

import { useId } from "react";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig } from "../_types/chat-config";
import { PROVIDER_MODELS, getDefaultModel } from "../_types/chat-config";

interface AgentConfigPanelProps {
  agents: AgentEntry[];
  selectedAgent: AgentEntry | null;
  config: ChatConfig;
  onChangeConfig: (config: ChatConfig) => void;
  onChangeAgent: (agent: AgentEntry) => void;
}

export default function AgentConfigPanel({
  agents,
  selectedAgent,
  config,
  onChangeConfig,
  onChangeAgent,
}: AgentConfigPanelProps) {
  const panelId = useId();

  const categories = [
    { key: "engineering", label: "Engineering" },
    { key: "validation", label: "Validation" },
    { key: "lifecycle", label: "Lifecycle" },
    { key: "knowledge", label: "Knowledge" },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">Agent Configuration</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Select a Society member and tune behavior</p>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Agent Selection */}
        <section>
          <label htmlFor={`${panelId}-agent`} className="mb-1.5 block text-xs font-medium text-zinc-400">
            Agent
          </label>
          <select
            id={`${panelId}-agent`}
            value={selectedAgent?.id ?? ""}
            onChange={(e) => {
              const agent = agents.find((a) => a.id === e.target.value);
              if (agent) {
                onChangeAgent(agent);
                const defaultModel = getDefaultModel(agent.preferredProvider);
                onChangeConfig({
                  ...config,
                  provider: agent.preferredProvider as ChatConfig["provider"],
                  model: defaultModel,
                });
              }
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="" disabled>Select an agent...</option>
            {categories.map((cat) => (
              <optgroup key={cat.key} label={cat.label}>
                {agents
                  .filter((a) => a.category === cat.key)
                  .map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {selectedAgent && (
            <p className="mt-1 text-xs text-zinc-500">
              {selectedAgent.name} &amp;middot; {selectedAgent.role}
            </p>
          )}
        </section>

        {/* System Prompt */}
        <section>
          <label htmlFor={`${panelId}-prompt`} className="mb-1.5 block text-xs font-medium text-zinc-400">
            System Prompt
          </label>
          <textarea
            id={`${panelId}-prompt`}
            value={config.systemPrompt}
            onChange={(e) => onChangeConfig({ ...config, systemPrompt: e.target.value })}
            readOnly
            rows={6}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 focus:border-emerald-500 focus:outline-none"
            placeholder="System prompt loaded from agent skill file..."
          />
          <p className="mt-1 text-xs text-zinc-600">Read-only. Synced from the agent&amp;apos;s SKILL.md</p>
        </section>

        {/* Model & Behavior */}
        <section>
          <h3 className="mb-2 text-xs font-medium text-zinc-400">Model &amp; Behavior</h3>

          <div className="space-y-3">
            <div>
              <label htmlFor={`${panelId}-provider`} className="mb-1 block text-xs text-zinc-500">
                Provider
              </label>
              <select
                id={`${panelId}-provider`}
                value={config.provider}
                onChange={(e) => {
                  const provider = e.target.value;
                  const defaultModel = getDefaultModel(provider);
                  onChangeConfig({ ...config, provider: provider as ChatConfig["provider"], model: defaultModel });
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
              </select>
            </div>

            <div>
              <label htmlFor={`${panelId}-model`} className="mb-1 block text-xs text-zinc-500">
                Model
              </label>
              <select
                id={`${panelId}-model`}
                value={config.model}
                onChange={(e) => onChangeConfig({ ...config, model: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                {PROVIDER_MODELS[config.provider]?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${panelId}-temp`} className="mb-1 block text-xs text-zinc-500">
                Temperature: {config.temperature.toFixed(1)}
              </label>
              <input
                id={`${panelId}-temp`}
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={(e) => onChangeConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Precise (0)</span>
                <span>Creative (2)</span>
              </div>
            </div>

            <div>
              <label htmlFor={`${panelId}-tokens`} className="mb-1 block text-xs text-zinc-500">
                Max Tokens: {config.maxTokens.toLocaleString()}
              </label>
              <input
                id={`${panelId}-tokens`}
                type="range"
                min={256}
                max={16384}
                step={256}
                value={config.maxTokens}
                onChange={(e) => onChangeConfig({ ...config, maxTokens: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>256</span>
                <span>16,384</span>
              </div>
            </div>
          </div>
        </section>

        {/* Safety */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <h3 className="mb-2 text-xs font-semibold text-zinc-400">Safety &amp; Limits</h3>
          <div className="space-y-1.5 text-xs text-zinc-500">
            <div className="flex justify-between">
              <span>Rate limit (chat)</span>
              <span className="font-mono text-zinc-400">20 req/min</span>
            </div>
            <div className="flex justify-between">
              <span>Max messages per session</span>
              <span className="font-mono text-zinc-400">50</span>
            </div>
            <div className="flex justify-between">
              <span>Max message length</span>
              <span className="font-mono text-zinc-400">4,000 chars</span>
            </div>
            <div className="flex justify-between">
              <span>Max tokens per response</span>
              <span className="font-mono text-zinc-400">{config.maxTokens.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* API Keys Notice */}
        <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-amber-400">API keys are server-side</p>
              <p className="mt-0.5 text-xs text-amber-500/70">
                Provider keys are stored in server environment variables. The browser never sees your keys.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
