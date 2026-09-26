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
  Collapse,
} from '@mantine/core';
import { useForm, isNotEmpty } from '@mantine/form';
import { openConfirmModal } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
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

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      executionType: 'webhook' as 'webhook' | 'sandbox',
      webhookUrl: '',
      code: '',
      schema: SCHEMA_TEMPLATE,
    },
    validate: {
      name: (v) => (isValidCustomToolName(v) ? null : 'Must match custom_[a-z][a-z0-9_]{1,62}'),
      description: isNotEmpty('Description is required'),
      webhookUrl: (v, values) => {
        if (values.executionType !== 'webhook') return null;
        try {
          new URL(v);
          return null;
        } catch {
          return 'Webhook URL must be a valid URL';
        }
      },
      schema: (v) => {
        try {
          JSON.parse(v);
          return null;
        } catch {
          return 'Schema must be valid JSON';
        }
      },
    },
    validateInputOnBlur: true,
  });

  const resetForm = () => {
    form.reset();
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (form.validate().hasErrors) return;
    const { name, description, executionType, webhookUrl, code, schema } = form.values;

    const def: CustomToolDefinition = {
      name,
      description: description.trim(),
      inputSchema: JSON.parse(schema),
      executionType,
      ...(executionType === 'webhook' ? { webhookUrl } : { code }),
    };

    const result = registerCustomTool(def);
    if (!result.ok) {
      notifications.show({ color: 'red', title: 'Cannot add tool', message: result.error });
      return;
    }

    setTools(getCustomTools());
    resetForm();
    notifications.show({ color: 'green', title: 'Tool added', message: `"${name}" is ready to use.` });
  };

  const handleDelete = (toolName: string) => {
    openConfirmModal({
      title: 'Delete custom tool?',
      children: `Delete custom tool "${toolName}"? This cannot be undone.`,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        unregisterCustomTool(toolName);
        setTools(getCustomTools());
      },
    });
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
                size="xs"
                {...form.getInputProps('name')}
              />
              <TextInput
                label="Description"
                placeholder="What this tool does"
                size="xs"
                {...form.getInputProps('description')}
              />
              <Select
                label="Execution Type"
                data={[
                  { value: 'webhook', label: 'Webhook' },
                  { value: 'sandbox', label: 'Sandbox' },
                ]}
                size="xs"
                {...form.getInputProps('executionType')}
              />
              {form.values.executionType === 'webhook' ? (
                <TextInput
                  label="Webhook URL"
                  placeholder="https://api.example.com/endpoint"
                  size="xs"
                  {...form.getInputProps('webhookUrl')}
                />
              ) : (
                <Textarea
                  label="Code"
                  placeholder="JavaScript code to execute"
                  minRows={3}
                  maxRows={8}
                  size="xs"
                  {...form.getInputProps('code')}
                />
              )}
              <Textarea
                label="Input Schema (JSON)"
                minRows={4}
                maxRows={10}
                size="xs"
                {...form.getInputProps('schema')}
              />
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
