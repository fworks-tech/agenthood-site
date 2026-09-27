"use client";

import { useId, useState } from "react";
import { Select, Switch, Button, Text, Group, Stack, Paper, Collapse, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";
import type { AgentEntry } from "../_data/agents";
import type { ChatConfig } from "../_types/studio";
import HelpTip from "./HelpTip";
import CustomToolsPanel from "./CustomToolsPanel";
import { TURNSTILE_REQUIRED } from "../_lib/env";

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
}

export function SectionHeader({
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
      aria-expanded={isOpen}
      aria-label={`Toggle ${label}`}
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
        className="text-zinc-400 dark:text-zinc-600 transition-transform duration-200 group-hover:text-zinc-600 dark:group-hover:text-zinc-400"
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
}: AgentConfigPanelProps) {
  const panelId = useId();
  const [toolsOpen, { toggle: toggleTools }] = useDisclosure(true);
  const [limitsOpen, { toggle: toggleLimits }] = useDisclosure(false);
  const [saved, setSaved] = useState(false);

  const categories = [
    { key: "engineering", label: "Engineering" },
    { key: "validation", label: "Validation" },
    { key: "lifecycle", label: "Lifecycle" },
    { key: "knowledge", label: "Knowledge" },
  ];

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

  const handleSave = () => {
    onSave?.(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Stack className="flex flex-col z-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      <Group justify="space-between" px="md" py="sm" className="border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <Group gap="xs">
            <Text size="sm" fw={600} c="gray.2">
              Agent Configuration
            </Text>
            <HelpTip
              text="Configuration panel for agent selection, tools, and safety limits."
              side="bottom"
            />
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Select a Society member and start chatting — no setup required
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

        {/* Tools — collapsible */}
        <div>
          <SectionHeader
            label="Tools"
            helpText="Enable tools the agent can use during conversations."
            isOpen={toolsOpen}
            onToggle={toggleTools}
          />
          <Collapse expanded={toolsOpen}>
            <Stack gap="sm" pt="sm">
              <Switch
                label="Web Fetch"
                description="fetch URL content (github.com, raw.githubusercontent.com, gist.github.com)"
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

        {/* Custom Tools — collapsible */}
        <CustomToolsPanel />

        {/* Safety & Limits — collapsible, default collapsed */}
        <div>
          <SectionHeader
            label="Limits"
            helpText="Built-in guardrails that protect against abuse."
            isOpen={limitsOpen}
            onToggle={toggleLimits}
          />
          <Collapse expanded={limitsOpen}>
            <Paper p="sm" className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 mt-sm">
              <Stack gap={6}>
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
                <Text size="xs" c="dimmed" className="italic">
                  Rate limits and message caps are server-enforced.
                </Text>
              </Stack>
            </Paper>
          </Collapse>
        </div>

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
