"use client";

import { useId, useState } from "react";
import { Select, TextInput, PasswordInput, Slider, Switch, Button, Text, Group, Stack, Paper, Alert, Collapse, UnstyledButton } from "@mantine/core";
import { IconBolt, IconChevronDown, IconCheck } from "@tabler/icons-react";
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
import Turnstile, { type TurnstileStatus } from "../../../components/Turnstile";

const TURNSTILE_ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED !== "false";
const TURNSTILE_REQUIRED =
  TURNSTILE_ENABLED && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
  captchaToken?: string | null;
  captchaRefreshKey?: number;
  onCaptchaToken?: (token: string | null) => void;
  onCaptchaError?: (error: string) => void;
  onCaptchaStatus?: (status: TurnstileStatus) => void;
  showCaptcha?: boolean;
  /** Render the widget interactively vs. invisible-but-active (mobile sheet uses invisible so tokens still flow). */
  captchaVisible?: boolean;
}

function SectionHeader({
  label,
  helpText,
  isOpen,
  onToggle,
}: {
  label: string;
  helpText: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onToggle}
      className="flex w-full items-center justify-between py-1.5 group"
    >
      <Group gap="xs">
        <div className="h-3 w-0.5 rounded-full bg-emerald-500" />
        <Text size="xs" fw={600} c="gray.4" className="uppercase tracking-wider">
          {label}
        </Text>
        <HelpTip text={helpText} side="right" />
      </Group>
      <IconChevronDown
        size={14}
        className="text-zinc-600 transition-transform duration-200 group-hover:text-zinc-400"
        style={{ transform: isOpen ? undefined : "rotate(-90deg)" }}
      />
    </UnstyledButton>
  );
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
  captchaToken,
  captchaRefreshKey,
  onCaptchaToken,
  onCaptchaError,
  onCaptchaStatus,
  showCaptcha = true,
  captchaVisible = true,
}: AgentConfigPanelProps) {
  const panelId = useId();
  const meta = getProviderMeta(config.provider);
  const [modelOpen, setModelOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const handleSave = () => {
    onSave?.(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

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

      <Stack p="md" gap="md">
        {/* Agent Selection — always visible */}
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
            <Text size="xs" c="dimmed" mt={4} className="transition-opacity duration-200">
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

        {/* Model & Behavior — collapsible */}
        <div>
          <SectionHeader
            label="Model & Behavior"
            helpText="Controls which AI model powers the agent and how it generates responses."
            isOpen={modelOpen}
            onToggle={() => setModelOpen((o) => !o)}
          />
          <Collapse expanded={modelOpen}>
            <Stack gap="sm" pt="sm">
              <div>
                <Group gap="xs" mb={4}>
                  <Text component="label" htmlFor={`${panelId}-provider`} size="xs" c="dimmed">
                    Provider
                  </Text>
                  <HelpTip
                    text="Choose which LLM service (Anthropic, OpenAI, Groq, Ollama, OpenCode) powers the agent."
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
                    text="Select the specific AI model version. Models vary in capability, speed, and cost."
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
                      text="The server endpoint for self-hosted providers (Ollama, OpenCode)."
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
                    text="Provide your own API key. If left blank, the servers default key is used."
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
                    text="Controls randomness. Lower = focused, higher = creative."
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
                    text="Limits response length. Larger values allow longer responses."
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
          </Collapse>
        </div>

        {/* Ollama connectivity check */}
        {config.provider === "ollama" && (
          <OllamaConnectivityCheck
            baseUrl={config.baseUrl ?? "http://localhost:11434"}
          />
        )}

        {/* Tools — collapsible */}
        <div>
          <SectionHeader
            label="Tools"
            helpText="Enable tools the agent can use during conversations."
            isOpen={toolsOpen}
            onToggle={() => setToolsOpen((o) => !o)}
          />
          <Collapse expanded={toolsOpen}>
            <Stack gap="sm" pt="sm">
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
          </Collapse>
        </div>

        {/* Safety & Limits — collapsible, default collapsed */}
        <div>
          <SectionHeader
            label="Limits"
            helpText="Built-in guardrails that protect against abuse."
            isOpen={limitsOpen}
            onToggle={() => setLimitsOpen((o) => !o)}
          />
          <Collapse expanded={limitsOpen}>
            <Paper p="sm" className="border border-zinc-800 bg-zinc-900/50 mt-sm">
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
          </Collapse>
        </div>

        {/* Captcha — above save button */}
        {showCaptcha && (
          <Turnstile
            onToken={onCaptchaToken ?? (() => {})}
            onError={onCaptchaError}
            onStatus={onCaptchaStatus}
            refreshKey={captchaRefreshKey}
            visible={captchaVisible}
          />
        )}

        {/* Save */}
        {onSave && (
          <Button
            fullWidth
            onClick={handleSave}
            disabled={TURNSTILE_REQUIRED && !captchaToken}
            className={`transition-all duration-200 ${saved ? "bg-emerald-600" : ""}`}
          >
            {saved ? (
              <Group gap={4}>
                <IconCheck size={14} />
                Saved
              </Group>
            ) : TURNSTILE_REQUIRED && !captchaToken ? (
              "Verify to save"
            ) : (
              "Save configuration"
            )}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
