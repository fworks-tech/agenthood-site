"use client";

import { Group, Text, Anchor, Badge } from "@mantine/core";
import { IconBrandGithub } from "@tabler/icons-react";
import HelpTip from "../(main)/studio/_components/HelpTip";

interface FooterProps {
  className?: string;
  version: string;
}

export default function Footer({ className = "", version }: FooterProps) {
  return (
    <footer
      className={`border-t border-zinc-800 px-6 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8 max-w-6xl mx-auto ${className}`}
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
            {`v${version}`}
          </Badge>
        </Group>
        <Anchor
          href="https://github.com/fworks-tech/agenthood"
          target="_blank"
          rel="noopener noreferrer"
          c="dimmed"
          className="flex min-h-11 items-center gap-1.5 hover:text-zinc-400 transition-colors"
        >
          <IconBrandGithub size={16} />
          <Text size="sm">GitHub</Text>
        </Anchor>
      </Group>
    </footer>
  );
}
