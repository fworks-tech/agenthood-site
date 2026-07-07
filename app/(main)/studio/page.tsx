import Link from "next/link";
import type { Metadata } from "next";
import { Text, Badge, Group, SimpleGrid } from "@mantine/core";
import { IconPlayerPlay, IconCode, IconShieldCheck, IconMessages } from "@tabler/icons-react";
import HelpTip from "./_components/HelpTip";

export const metadata: Metadata = {
  title: "Agenthood Studio — Try AI agents in your browser",
  description: "Chat with 16 specialized AI agents live. Select your provider and start a conversation.",
};

export default function StudioHubPage() {
  return (
    <div className="h-full bg-zinc-950">
      <section className="border border-zinc-800">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <Group justify="center" mb="md">
            <Badge variant="outline" color="dark" size="sm" leftSection={<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}>
              Agenthood Studio
            </Badge>
          </Group>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Try the Society live
          </h1>
          <Text className="mx-auto mt-4 max-w-2xl text-base leading-relaxed" c="dimmed">
            Select any of the 16 AI agent members, pick your provider, and start a conversation.
            All requests are routed server-side through the agenthood runtime.
          </Text>
          <Group justify="center" mt="lg" gap="md">
            <Link
              href="/studio/playground"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <IconPlayerPlay size={16} />
              Open Playground
            </Link>
            <Link
              href="/getting-started"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Getting started
            </Link>
          </Group>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-emerald-500">
              <IconMessages size={20} />
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-zinc-200">
              Talk to any member
              <HelpTip text="Each member's system prompt is synced from its SKILL.md file at build time." />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Each of the 16 Society members has its own system prompt synced from its SKILL.md file.
              Select one and start a conversation with their exact agent persona.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-blue-500">
              <IconCode size={20} />
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-zinc-200">
              Choose your provider
              <HelpTip text="Switch between 6 providers. Adjust temperature, max tokens, and model per conversation." />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Switch between Anthropic, OpenAI, Groq, Ollama, or your own OpenCode server.
              Adjust temperature, max tokens, and model per conversation.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-purple-500">
              <IconShieldCheck size={20} />
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-zinc-200">
              Server-side routing
              <HelpTip text="Requests go through the LLMRouter with automatic failover. Rate limited and logged." />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Every request goes through the agenthood LLMRouter with automatic failover.
              Rate limited, validated, and logged server-side. Your keys are never stored on the server.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-amber-500">
              <IconMessages size={20} />
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-zinc-200">
              Conversations saved
              <HelpTip text="Chat history persists in your browser between sessions via localStorage." />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Chat history persists in your browser between sessions.
              Switch between conversations, clear history, or start fresh.
            </p>
          </div>
        </SimpleGrid>
      </section>
    </div>
  );
}
