"use client";

import { Tooltip } from "@mantine/core";

interface HelpTipProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export default function HelpTip({ text, side = "top", className = "" }: HelpTipProps) {
  return (
    <span className={className}>
      <Tooltip
        label={text}
        position={side}
        withArrow
        openDelay={300}
        events={{ hover: true, focus: true, touch: true }}
      >
        <button
          type="button"
          className="cursor-help inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 text-[10px] leading-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors select-none"
          aria-label={`Help: ${text}`}
        >
          ?
        </button>
      </Tooltip>
    </span>
  );
}
