"use client";

import { useId } from "react";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig, Provider } from "../_types/studio";
import { PROVIDER_MODELS, getDefaultModel, getProviderMeta, CODE_AGENTS } from "../_types/studio";
import OllamaConnectivityCheck from "./OllamaConnectivityCheck";
import HelpTip from "./HelpTip";

interface AgentConfigPanelProps {
  agents: AgentEntry[];
  isLoading?: boolean;
  error?: string | null;
  selectedAgent: AgentEntry | null;
  config: ChatConfig;
  onChangeConfig: (config: ChatConfig) => void;
  onChangeAgent: (agent: AgentEntry) => void;
  onSave?: (config: ChatConfig) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AgentConfigPanel({
  agents,
  isLoading,
  error,
  selectedAgent,
  config,
  onChangeConfig,
  onChangeAgent,
  onSave,
  collapsed = false,
  onToggleCollapse,
}: AgentConfigPanelProps) {
  const panelId = useId();
  const meta = getProviderMeta(config.provider);

  const categories = [
    { key: "engineering", label: "Engineering" },
    { key: "validation", label: "Validation" },
    { key: "lifecycle", label: "Lifecycle" },
    { key: "knowledge", label: "Knowledge" },
  ];

  const handleProviderChange = (provider: string) => {
    const p = provider as Provider;
    const m = getProviderMeta(p);
    onChangeConfig({
      ...config,
      provider: p,
      model: getDefaultModel(p),
      baseUrl: m.defaultBaseUrl ?? config.baseUrl,
    });
  };

  const isCodeAgent = selectedAgent && CODE_AGENTS.has(selectedAgent.id);
  const isOpenCodeSuggestion = isCodeAgent && config.provider !== "opencode" && config.provider !== "opencode-go";

  return (
    <div className="flex flex-col overflow-y-auto border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Agent Configuration</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Select a Society member and tune behavior</p>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            aria-label={collapsed ? "Expand configuration" : "Collapse configuration"}
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {!collapsed && (
      <div className="flex-1 space-y-5 p-4">
        {/* Agent Selection */}
        <section>
          <label htmlFor={`${panelId}-agent`} className="mb-1.5 flex items-center gap-1 text-xs font-medium text-zinc-400">
            Agent
            <HelpTip text="Choose a specialized AI agent member. Each has a unique role and system prompt optimized for specific tasks." />
          </label>
          <select
            id={`${panelId}-agent`}
            value={selectedAgent?.id ?? ""}
            disabled={isLoading || !!error}
            onChange={(e) => {
              const agent = agents.find((a) => a.id === e.target.value);
              if (agent) {
                onChangeAgent(agent);
                handleProviderChange(agent.preferredProvider);
              }
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          >
            {isLoading ? (
              <option value="" disabled>Loading agents...</option>
            ) : error ? (
              <option value="" disabled>Failed to load agents</option>
            ) : (
              <>
                <option value="" disabled>Select an agent...</option>
                {categories.map((cat) => (
                  <optgroup key={cat.key} label={cat.label}>
                    {agents
                      .filter((a) => a.category === cat.key)
                      .map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.icon ?? ""} {agent.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </>
            )}
          </select>
          {selectedAgent && (
            <p className="mt-1 text-xs text-zinc-500">
              {selectedAgent.name} · {selectedAgent.role}
            </p>
          )}
        </section>

        {/* OpenCode affinity hint */}
        {isOpenCodeSuggestion && (
          <section className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                  Code-optimized provider available
                  <HelpTip text="This code-focused agent is optimized for OpenCode providers offering lower latency and better coding performance." />
                </p>
                <p className="mt-0.5 text-xs text-emerald-500/70">
                  {selectedAgent!.name} works best with a code-optimized provider.
                </p>
                <button
                  onClick={() => handleProviderChange("opencode")}
                  className="mt-1.5 rounded border border-emerald-700 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                >
                  Switch to OpenCode
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Model & Behavior */}
        <section>
          <h3 className="mb-2 text-xs font-medium text-zinc-400">Model &amp; Behavior</h3>

          <div className="space-y-3">
            <div>
              <label htmlFor={`${panelId}-provider`} className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                Provider
                <HelpTip text="Choose which LLM service (Anthropic, OpenAI, Groq, Ollama, OpenCode) powers the agent. Each offers different models and pricing." />
              </label>
              <select
                id={`${panelId}-provider`}
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                {(Object.entries(PROVIDER_MODELS) as [Provider, typeof meta][]).map(([key, m]) => (
                  <option key={key} value={key}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${panelId}-model`} className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                Model
                <HelpTip text="Select the specific AI model version. Models vary in capability, speed, and cost. The default model is recommended." />
              </label>
              <select
                id={`${panelId}-model`}
                value={config.model}
                onChange={(e) => onChangeConfig({ ...config, model: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                {meta.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Base URL (for Ollama / OpenCode) */}
            {meta.requiresBaseUrl && (
              <div>
                <label htmlFor={`${panelId}-baseurl`} className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                  Base URL
                  <HelpTip text="The server endpoint for self-hosted providers (Ollama, OpenCode). Leave as default unless running on a custom address." />
                </label>
                <input
                  id={`${panelId}-baseurl`}
                  type="text"
                  value={config.baseUrl ?? meta.defaultBaseUrl ?? ""}
                  onChange={(e) => onChangeConfig({ ...config, baseUrl: e.target.value })}
                  placeholder={meta.defaultBaseUrl}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {/* API Key (optional — for BYOK) */}
            <div>
              <label htmlFor={`${panelId}-apikey`} className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                API Key <span className="text-zinc-600">(optional)</span>
                <HelpTip text="Provide your own API key. If left blank, the servers default key is used. Sent server-side only; never stored." />
              </label>
              <div className="relative">
                <input
                  id={`${panelId}-apikey`}
                  type="password"
                  value={config.apiKey ?? ""}
                  onChange={(e) => onChangeConfig({ ...config, apiKey: e.target.value || undefined })}
                  placeholder={meta.requiresKey ? `Uses server ${config.provider} key` : "Not required"}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-8 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                Sent server-side for this request only. Never logged or stored.
              </p>
            </div>

            <div>
              <label htmlFor={`${panelId}-temp`} className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                Temperature: {config.temperature.toFixed(1)}
                <HelpTip text="Controls randomness in responses. Lower values (0) produce more focused answers; higher values (2) generate more creative output." />
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
                <span className="flex items-center gap-1">
                  Precise (0)
                  <HelpTip text="At 0, the model picks the most likely tokens for deterministic, focused responses." side="left" />
                </span>
                <span className="flex items-center gap-1">
                  Creative (2)
                  <HelpTip text="At 2, the model explores more surprising alternatives for creative, varied output." side="right" />
                </span>
              </div>
            </div>

            <div>
              <label htmlFor={`${panelId}-tokens`} className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                Max Tokens: {config.maxTokens.toLocaleString()}
                <HelpTip text="Limits the length of each response. A token is roughly one word. Larger values allow longer responses but consume more context." />
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
                <span className="flex items-center gap-1">
                  256
                  <HelpTip text="Minimum response length. The model will always produce at least 256 tokens per response." side="left" />
                </span>
                <span className="flex items-center gap-1">
                  16,384
                  <HelpTip text="Maximum response length. Higher values allow very long responses but consume more context window space." side="right" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Ollama connectivity check */}
        {config.provider === "ollama" && (
          <OllamaConnectivityCheck baseUrl={config.baseUrl ?? "http://localhost:11434"} />
        )}

        {/* Safety */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold text-zinc-400">
            Safety &amp; Limits
            <HelpTip text="Built-in guardrails that protect against abuse. These limits apply to all conversations." />
          </h3>
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



        {/* Save */}
        {onSave && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSave(config)}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Save configuration
            </button>
            <HelpTip text="Persists the current provider, model, and settings to your browsers local storage." side="right" />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
