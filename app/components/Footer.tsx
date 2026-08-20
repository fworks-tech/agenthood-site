"use client";

import { Group, Text, Anchor, Badge } from "@mantine/core";
import { IconBrandGithub } from "@tabler/icons-react";
import HelpTip from "../(main)/studio/_components/HelpTip";
import { useState, useEffect } from "react";

interface FooterProps {
  className?: string;
}

export default function Footer({ className = "" }: FooterProps) {
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const res = await fetch("https://registry.npmjs.org/agenthood/latest");
        if (!res.ok) throw new Error("Failed to fetch version");
        const data = await res.json();
        setVersion(data?.version || null);
      } catch {
        setVersion("3.35.0");
      } finally {
        setLoading(false);
      }
    }
    fetchVersion();
  }, []);

  if (loading) {
    return (
      <footer
        className={`border-t border-zinc-800 px-6 py-8 max-w-6xl mx-auto ${className}`}
      >
        <Group justify="space-between" gap="sm" className="flex-col sm:flex-row">
          <Group gap="sm" className="text-sm text-zinc-500">
            <Text size="sm" c="dimmed">
              agenthood &middot; by{" "}
              <Anchor href="https://flabs.tech" c="dimmed">
                Fabio Ritzel Borges
              </Anchor>
            </Text>
            <Badge
              size="sm"
              variant="outline"
              color="dark"
              styles={{ root: { fontFamily: "var(--mantine-font-family-monospace)" } }}
              rightSection={
                <HelpTip text="The currently installed version of Agenthood. See the Releases page for history." side="top" />
              }
            >
              loading...
            </Badge>
          </Group>
          <Anchor
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            c="dimmed"
            className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors"
          >
            <IconBrandGithub size={16} />
            <Text size="sm">GitHub</Text>
          </Anchor>
        </Group>
      </footer>
    );
  }

  return (
    <footer
      className={`border-t border-zinc-800 px-6 py-8 max-w-6xl mx-auto ${className}`}
    >
      <Group justify="space-between" gap="sm" className="flex-col sm:flex-row">
        <Group gap="sm" className="text-sm text-zinc-500">
          <Text size="sm" c="dimmed">
            agenthood &middot; by{" "}
            <Anchor href="https://flabs.tech" c="dimmed">
              Fabio Ritzel Borges
            </Anchor>
          </Text>
          <Badge
            size="sm"
            variant="outline"
            color="dark"
            styles={{ root: { fontFamily: "var(--mantine-font-family-monospace)" } }}
            rightSection={
              <HelpTip text="The currently installed version of Agenthood. See the Releases page for history." side="top" />
            }
            >
              {version ? `v${version}` : "v3.35.0"}
            </Badge>
        </Group>
        <Anchor
          href="https://github.com/fworks-tech/agenthood"
          target="_blank"
          rel="noopener noreferrer"
          c="dimmed"
          className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors"
        >
          <IconBrandGithub size={16} />
          <Text size="sm">GitHub</Text>
        </Anchor>
      </Group>
    </footer>
  );
}
