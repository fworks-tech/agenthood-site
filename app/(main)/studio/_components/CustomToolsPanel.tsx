'use client';

import { useState } from 'react';
import {
  Stack,
  Text,
  TextInput,
  Select,
  Button,
  Group,
  Paper,
  ActionIcon,
  Textarea,
  Alert,
  Collapse,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import {
  getCustomTools,
  registerCustomTool,
  unregisterCustomTool,
  isValidCustomToolName,
  type CustomToolDefinition,
} from '../_lib/custom-tools';
import { SectionHeader } from './AgentConfigPanel';

const SCHEMA_TEMPLATE = JSON.stringify(
  {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' },
    },
    required: ['input'],
  },
  null,
  2,
);

export default function CustomToolsPanel() {
  const [tools, setTools] = useState<CustomToolDefinition[]>(() => getCustomTools());
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [executionType, setExecutionType] = useState<'webhook' | 'sandbox'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [code, setCode] = useState('');
  const [schema, setSchema] = useState(SCHEMA_TEMPLATE);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setExecutionType('webhook');
    setWebhookUrl('');
    setCode('');
    setSchema(SCHEMA_TEMPLATE);
    setError(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    setError(null);

    if (!isValidCustomToolName(name)) {
      setError(`Invalid tool name "${name}". Must match custom_[a-z][a-z0-9_]{1,62}`);
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (executionType === 'webhook') {
      try {
        new URL(webhookUrl);
      } catch {
        setError('Webhook URL must be a valid URL');
        return;
      }
    }

    let inputSchema: CustomToolDefinition['inputSchema'];
    try {
      inputSchema = JSON.parse(schema);
    } catch {
      return setError('Schema must be valid JSON');
    }

    const def: CustomToolDefinition = {
      name,
      description: description.trim(),
      inputSchema,
      executionType,
      ...(executionType === 'webhook' ? { webhookUrl } : { code }),
    };

    const result = registerCustomTool(def);
    if (!result.ok) {
      return setError(result.error);
    }

    setTools(getCustomTools());
    resetForm();
  };

  const handleDelete = (toolName: string) => {
    if (!window.confirm(`Delete custom tool "${toolName}"?`)) return;
    unregisterCustomTool(toolName);
    setTools(getCustomTools());
  };

  return (
    <div>
      <SectionHeader
        label={`Custom Tools (${tools.length})`}
        helpText="Define your own tools with webhook or sandbox execution."
        isOpen={isOpen}
        onToggle={() => setIsOpen((o) => !o)}
      />
      <Collapse expanded={isOpen}>
        <Stack gap="sm" pt="sm">
          {tools.length === 0 && (
            <Text size="xs" c="dimmed">
              No custom tools yet. Add one to extend agent capabilities.
            </Text>
          )}
          {tools.map((tool) => (
            <Paper
              key={tool.name}
              p="xs"
              className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50"
            >
              <Group justify="space-between" align="flex-start">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="xs" fw={600} c="gray.2">
                    {tool.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {tool.description}
                  </Text>
                  <Text size="xs" c="dimmed" className="font-mono">
                    {tool.executionType}
                  </Text>
                </Stack>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => handleDelete(tool.name)}
                  aria-label={`Delete ${tool.name}`}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}

          {showForm ? (
            <Stack gap="xs" pt="xs">
              <TextInput
                label="Tool Name"
                placeholder="custom_my_tool"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                size="xs"
              />
              <TextInput
                label="Description"
                placeholder="What this tool does"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                size="xs"
              />
              <Select
                label="Execution Type"
                value={executionType}
                onChange={(v) => setExecutionType(v as 'webhook' | 'sandbox')}
                data={[
                  { value: 'webhook', label: 'Webhook' },
                  { value: 'sandbox', label: 'Sandbox' },
                ]}
                size="xs"
              />
              {executionType === 'webhook' ? (
                <TextInput
                  label="Webhook URL"
                  placeholder="https://api.example.com/endpoint"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.currentTarget.value)}
                  size="xs"
                />
              ) : (
                <Textarea
                  label="Code"
                  placeholder="JavaScript code to execute"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  minRows={3}
                  maxRows={8}
                  autosize
                  size="xs"
                />
              )}
              <Textarea
                label="Input Schema (JSON)"
                value={schema}
                onChange={(e) => setSchema(e.currentTarget.value)}
                minRows={4}
                maxRows={10}
                autosize
                size="xs"
              />
              {error && (
                <Alert color="red" title={error} />
              )}
              <Group justify="flex-end" gap="xs">
                <Button size="compact-xs" variant="subtle" onClick={resetForm}>
                  Cancel
                </Button>
                <Button size="compact-xs" onClick={handleSubmit}>
                  Add Tool
                </Button>
              </Group>
            </Stack>
          ) : (
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<IconPlus size={14} />}
              onClick={() => setShowForm(true)}
            >
              Add Tool
            </Button>
          )}
        </Stack>
      </Collapse>
    </div>
  );
}
