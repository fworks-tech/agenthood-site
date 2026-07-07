"use client";

import { useRef, useEffect } from "react";
import { Group, Text, Badge, Collapse, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import HelpTip from "./HelpTip";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface LiveLogsProps {
  logs: LogEntry[];
  open?: boolean;
  onToggle?: () => void;
}

function getLevelColor(level: string) {
  switch (level) {
    case "error": return "red.4";
    case "warn": return "yellow.4";
    default: return "emerald.4";
  }
}

function getBadgeColor(level: string) {
  switch (level) {
    case "error": return "red";
    case "warn": return "yellow";
    default: return "emerald";
  }
}

export default function LiveLogs({ logs, open = true, onToggle }: LiveLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, open]);

  return (
    <div className="border border-zinc-800 bg-zinc-950">
      <UnstyledButton
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-1.5 hover:bg-zinc-900 transition-colors"
      >
        <Group gap="xs">
          <IconChevronDown
            size={14}
            className="text-zinc-500 transition-transform duration-200"
            style={{ transform: open ? undefined : "rotate(-90deg)" }}
          />
          <Text size="xs" fw={500} c="zinc.5" className="flex items-center gap-1">
            Live Logs
            <HelpTip text="Real-time event log showing request routing, provider calls, errors, and system messages." />
          </Text>
        </Group>
        <Text size="xs" c="zinc.6">{logs.length} events</Text>
      </UnstyledButton>
      <Collapse expanded={open}>
        <div
          ref={scrollRef}
          className="h-20 md:h-28 overflow-y-auto border-t border-zinc-800/50"
        >
          <div className="px-3 py-2 font-mono text-[11px] leading-relaxed">
            {logs.length === 0 ? (
              <Group gap="xs">
                <Text size="xs" c="zinc.6" fs="italic">
                  Waiting for events...
                </Text>
                <HelpTip text="Log entries appear here once you send a message or interact with an agent." />
              </Group>
            ) : (
              logs.map((log, i) => (
                <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                  <Text size="xs" c="zinc.6" className="shrink-0">{log.time}</Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color={getBadgeColor(log.level)}
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <Text size="xs" c={getLevelColor(log.level)}>{log.message}</Text>
                </Group>
              ))
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}
