"use client";

import { useState, useEffect, useMemo } from "react";
import { Alert, Text, Loader, Group } from "@mantine/core";
import { IconInfoCircle, IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";
import HelpTip from "./HelpTip";

interface OllamaConnectivityCheckProps {
  baseUrl: string;
}

function isValidOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.protocol === "https:") return true;
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "host.docker.internal";
  } catch {
    return false;
  }
}

export default function OllamaConnectivityCheck({ baseUrl }: OllamaConnectivityCheckProps) {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected" | "invalid">("checking");
  const validUrl = useMemo(() => isValidOllamaUrl(baseUrl), [baseUrl]);

  useEffect(() => {
    if (!validUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("invalid");
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setStatus(res.ok ? "connected" : "disconnected");
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    }

    check();
    return () => { cancelled = true; };
  }, [baseUrl, validUrl]);

  if (status === "invalid") {
    return (
      <Alert variant="outline" color="yellow" icon={<IconInfoCircle size={16} />} py="sm" px="md">
        <Text size="xs" fw={500} c="yellow.3">
          Invalid Ollama URL — only http://localhost, http://127.0.0.1, and https:// URLs are allowed.
        </Text>
      </Alert>
    );
  }

  if (status === "checking") {
    return (
      <Alert variant="outline" color="gray" py="sm" px="md" styles={{ root: { borderColor: "var(--mantine-color-zinc-8)" } }}>
        <Group gap="sm">
          <Loader size="xs" color="zinc.5" />
          <Text size="xs" c="zinc.5" className="flex items-center gap-1">
            Checking Ollama connection...
            <HelpTip text="Verifies that your local Ollama instance is reachable before sending requests." />
          </Text>
        </Group>
      </Alert>
    );
  }

  if (status === "connected") {
    return (
      <Alert variant="outline" color="emerald" icon={<IconCircleCheck size={16} />} py="sm" px="md">
        <Text size="xs" c="emerald.4" className="flex items-center gap-1">
          Ollama connected at {baseUrl}
          <HelpTip text="Ollama is reachable and ready. Requests will be sent to your local instance." />
        </Text>
      </Alert>
    );
  }

  return (
    <Alert variant="outline" color="yellow" icon={<IconAlertTriangle size={16} />} py="sm" px="md">
      <Group gap="xs">
        <Text size="xs" fw={500} c="yellow.3">
          Ollama not detected
          <HelpTip text="If disconnected, ensure Ollama is running and the Base URL above is correct." />
        </Text>
      </Group>
      <Text size="xs" c="yellow.5" mt={4}>
        Make sure Ollama is running at {baseUrl}.&nbsp;
        <Text
          component="a"
          href="https://ollama.com"
          target="_blank"
          rel="noopener noreferrer"
          c="yellow.3"
          className="underline hover:text-yellow-2"
        >
          Download Ollama
        </Text>
      </Text>
    </Alert>
  );
}
