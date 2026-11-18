"use client";

import { useClipboard } from "@mantine/hooks";
import { IconCopy, IconCheck } from "@tabler/icons-react";

const COMMANDS = "npm install --save-dev agenthood\nnpx agenthood init";

export default function InstallBlock() {
  const { copy, copied } = useClipboard({ timeout: 2000 });

  const handleCopy = () => {
    copy(COMMANDS);
  };

  return (
    <div className="inline-flex items-center gap-2 sm:gap-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-xl px-3 sm:px-5 py-3.5 font-mono text-xs sm:text-sm shadow-inner max-w-lg w-full">
      <div className="flex-1 min-w-0 overflow-x-auto text-left">
        <div className="whitespace-nowrap text-zinc-500">$ <span className="text-zinc-200">npm install --save-dev agenthood</span></div>
        <div className="whitespace-nowrap text-zinc-500">$ <span className="text-zinc-200">npx agenthood init</span></div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        aria-label="Copy install commands"
        title="Copy to clipboard"
      >
        {copied ? <IconCheck size={16} className="text-emerald-400" /> : <IconCopy size={16} />}
      </button>
    </div>
  );
}
