"use client";

import { useId } from "react";
import { Select, TextInput, PasswordInput, Slider, Switch, Button, Text, Group, Stack, Paper, Alert } from "@mantine/core";
import { IconBolt } from "@tabler/icons-react";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig, Provider } from "../_types/studio";
import {
  PROVIDER_MODELS,
  getDefaultModel,
  getProviderMeta,
  CODE_AGENTS,
} from "../_types/studio";
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
  const isOpenCodeSuggestion =
    isCodeAgent &&
    config.provider !== "opencode" &&
    config.provider !== "opencode-go";

  const agentOptions = isLoading
    ? [{ value: "", label: "Loading agents...", disabled: true }]
    : error
      ? [{ value: "", label: "Failed to load agents", disabled: true }]
      : [
          { value: "", label: "Select an agent...", disabled: true },
          ...categories.flatMap((cat) => {
            const catAgents = agents.filter((a) => a.category === cat.key);
            return catAgents.length > 0
              ? [
                  { value: `__group__${cat.label}`, label: cat.label, disabled: true },
                  ...catAgents.map((a) => ({
                    value: a.id,
                    label: `${a.icon ?? ""} ${a.name}`,
                  })),
                ]
              : [];
          }),
        ];

  const providerOptions = (Object.entries(PROVIDER_MODELS) as [Provider, typeof meta][]).map(
    ([key, m]) => ({ value: key, label: m.label })
  );

  const modelOptions = meta.models.map((m) => ({
    value: m.id,
    label: m.label,
  }));

  return (
    <Stack className="flex flex-col z-0 overflow-hidden border border-zinc-800 bg-zinc-950">
      <Group justify="space-between" px="md" py="sm" className="border-b border-zinc-800">
        <div>
          <Group gap="xs">
            <Text size="sm" fw={600} c="gray.2">
              Agent Configuration
            </Text>
            <HelpTip
              text="Configuration panel for agent selection, provider, model, and safety limits."
              side="bottom"
            />
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Select a Society member and tune behavior
          </Text>
        </div>
      </Group>

      <Stack p="md" gap="lg">
        {/* Agent Selection */}
        <div>
          <Group gap="xs" mb={4}>
            <Text component="label" htmlFor={`${panelId}-agent`} size="xs" fw={500} c="gray.5">
              Agent
            </Text>
            <HelpTip
              text="Choose a specialized AI agent member. Each has a unique role and system prompt optimized for specific tasks."
              side="right"
            />
          </Group>
          <Select
            id={`${panelId}-agent`}
            data={agentOptions}
            value={selectedAgent?.id ?? null}
            disabled={isLoading || !!error}
            onChange={(value) => {
              if (!value) return;
              const agent = agents.find((a) => a.id === value);
              if (agent) {
                onChangeAgent(agent);
                handleProviderChange(agent.preferredProvider);
              }
            }}
            searchable
            nothingFoundMessage="No agents found"
          />
          {selectedAgent && (
            <Text size="xs" c="dimmed" mt={4}>
              {selectedAgent.name} · {selectedAgent.role}
            </Text>
          )}
        </div>

        {/* OpenCode affinity hint */}
        {isOpenCodeSuggestion && (
          <Alert variant="outline" color="emerald" icon={<IconBolt size={16} />}>
            <Group gap="xs" mb={4}>
              <Text size="xs" fw={600} c="emerald.3">
                Code-optimized provider available
              </Text>
              <HelpTip text="This code-focused agent is optimized for OpenCode providers offering lower latency and better coding performance." />
            </Group>
            <Text size="xs" c="emerald.5">
              {selectedAgent!.name} works best with a code-optimized provider.
            </Text>
            <Button
              size="compact-xs"
              variant="outline"
              color="emerald"
              mt={6}
              onClick={() => handleProviderChange("opencode")}
            >
              Switch to OpenCode
            </Button>
          </Alert>
        )}

        {/* Model & Behavior */}
        <div>
          <Group gap="xs" mb="sm">
            <Text size="xs" fw={500} c="gray.5">
              Model & Behavior
            </Text>
            <HelpTip
              text="Controls which AI model powers the agent and how it generates responses."
              side="right"
            />
          </Group>

          <Stack gap="sm">
            <div>
              <Group gap="xs" mb={4}>
                <Text component="label" htmlFor={`${panelId}-provider`} size="xs" c="dimmed">
                  Provider
                </Text>
                <HelpTip
                  text="Choose which LLM service (Anthropic, OpenAI, Groq, Ollama, OpenCode) powers the agent. Each offers different models and pricing."
                  side="right"
                />
              </Group>
              <Select
                id={`${panelId}-provider`}
                data={providerOptions}
                value={config.provider}
                onChange={(value) => value && handleProviderChange(value)}
              />
            </div>

            <div>
              <Group gap="xs" mb={4}>
                <Text component="label" htmlFor={`${panelId}-model`} size="xs" c="dimmed">
                  Model
                </Text>
                <HelpTip
                  text="Select the specific AI model version. Models vary in capability, speed, and cost. The default model is recommended."
                  side="right"
                />
              </Group>
              <Select
                id={`${panelId}-model`}
                data={modelOptions}
                value={config.model}
                onChange={(value) => value && onChangeConfig({ ...config, model: value })}
              />
            </div>

            {meta.requiresBaseUrl && (
              <div>
                <Group gap="xs" mb={4}>
                  <Text component="label" htmlFor={`${panelId}-baseurl`} size="xs" c="dimmed">
                    Base URL
                  </Text>
                  <HelpTip
                    text="The server endpoint for self-hosted providers (Ollama, OpenCode). Leave as default unless running on a custom address."
                    side="right"
                  />
                </Group>
                <TextInput
                  id={`${panelId}-baseurl`}
                  value={config.baseUrl ?? meta.defaultBaseUrl ?? ""}
                  onChange={(e) => onChangeConfig({ ...config, baseUrl: e.currentTarget.value })}
                  placeholder={meta.defaultBaseUrl}
                />
              </div>
            )}

            <div>
              <Group gap="xs" mb={4}>
                <Text component="label" htmlFor={`${panelId}-apikey`} size="xs" c="dimmed">
                  API Key <Text component="span" size="xs" c="dimmed">(optional)</Text>
                </Text>
                <HelpTip
                  text="Provide your own API key. If left blank, the servers default key is used. Sent server-side only; never stored."
                  side="right"
                />
              </Group>
              <PasswordInput
                id={`${panelId}-apikey`}
                value={config.apiKey ?? ""}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    apiKey: e.currentTarget.value || undefined,
                  })
                }
                placeholder={
                  meta.requiresKey
                    ? `Uses server ${config.provider} key`
                    : "Not required"
                }
              />
              <Text size="xs" c="dimmed" mt={4}>
                Sent server-side for this request only. Never logged or stored.
              </Text>
            </div>

            <div>
              <Group gap="xs" mb={4}>
                <Text component="label" htmlFor={`${panelId}-temp`} size="xs" c="dimmed">
                  Temperature: {config.temperature.toFixed(1)}
                </Text>
                <HelpTip
                  text="Controls randomness in responses. Lower values (0) produce more focused answers; higher values (2) generate more creative output."
                  side="right"
                />
              </Group>
              <Slider
                id={`${panelId}-temp`}
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={(val) => onChangeConfig({ ...config, temperature: val })}
                label={(val) => val.toFixed(1)}
                marks={[
                  { value: 0, label: "Precise" },
                  { value: 2, label: "Creative" },
                ]}
              />
            </div>

            <div>
              <Group gap="xs" mb={4}>
                <Text component="label" htmlFor={`${panelId}-tokens`} size="xs" c="dimmed">
                  Max Tokens: {config.maxTokens.toLocaleString()}
                </Text>
                <HelpTip
                  text="Limits the length of each response. A token is roughly one word. Larger values allow longer responses but consume more context window."
                  side="right"
                />
              </Group>
              <Slider
                id={`${panelId}-tokens`}
                min={256}
                max={16384}
                step={256}
                value={config.maxTokens}
                onChange={(val) => onChangeConfig({ ...config, maxTokens: val })}
                label={(val) => val.toLocaleString()}
                marks={[
                  { value: 256, label: "256" },
                  { value: 16384, label: "16K" },
                ]}
              />
            </div>
          </Stack>
        </div>

        {/* Ollama connectivity check */}
        {config.provider === "ollama" && (
          <OllamaConnectivityCheck
            baseUrl={config.baseUrl ?? "http://localhost:11434"}
          />
        )}

        {/* Tools */}
        <div>
          <Group gap="xs" mb="sm">
            <Text size="xs" fw={500} c="gray.5">
              Tools & Capabilities
            </Text>
            <HelpTip
              text="Enable tools the agent can use. web_fetch fetches URLs (allowed hosts: github.com). code_execution runs JavaScript in a sandboxed VM."
              side="right"
            />
          </Group>
          <Stack gap="sm">
            <Switch
              label="Web Fetch"
              description="fetch URL content"
              checked={config.enabledTools?.includes("web_fetch") ?? false}
              onChange={(e) => {
                const tools = config.enabledTools ?? [];
                const updated = e.currentTarget.checked
                  ? [...tools, "web_fetch"]
                  : tools.filter((t) => t !== "web_fetch");
                onChangeConfig({ ...config, enabledTools: updated });
              }}
            />
            <Switch
              label="Code Execution"
              description="run JavaScript"
              checked={config.enabledTools?.includes("code_execution") ?? false}
              onChange={(e) => {
                const tools = config.enabledTools ?? [];
                const updated = e.currentTarget.checked
                  ? [...tools, "code_execution"]
                  : tools.filter((t) => t !== "code_execution");
                onChangeConfig({ ...config, enabledTools: updated });
              }}
            />
          </Stack>
        </div>

        {/* Safety */}
        <Paper p="sm" className="border border-zinc-800 bg-zinc-900/50">
          <Group gap="xs" mb="sm">
            <Text size="xs" fw={600} c="gray.5">
              Safety & Limits
            </Text>
            <HelpTip text="Built-in guardrails that protect against abuse. These limits apply to all conversations." side="right" />
          </Group>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Rate limit (chat)</Text>
              <Text size="xs" className="font-mono" c="gray.5">20 req/min</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Max messages per session</Text>
              <Text size="xs" className="font-mono" c="gray.5">50</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Max message length</Text>
              <Text size="xs" className="font-mono" c="gray.5">4,000 chars</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Max tokens per response</Text>
              <Text size="xs" className="font-mono" c="gray.5">
                {config.maxTokens.toLocaleString()}
              </Text>
            </Group>
          </Stack>
        </Paper>

        {/* Save */}
        {onSave && (
          <Button
            fullWidth
            onClick={() => onSave(config)}
          >
            Save configuration
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
