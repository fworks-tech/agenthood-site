"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";

const COMMANDS = "npm install --save-dev agenthood\nnpx agenthood init";

export default function InstallBlock() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silent fail
    }
  };

  return (
    <div className="inline-flex items-center gap-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-xl px-5 py-3.5 font-mono text-sm shadow-inner max-w-lg w-full">
      <div className="flex-1 text-left">
        <div className="text-zinc-500">$ <span className="text-zinc-200">npm install --save-dev agenthood</span></div>
        <div className="text-zinc-500">$ <span className="text-zinc-200">npx agenthood init</span></div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 p-2 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        aria-label="Copy install commands"
        title="Copy to clipboard"
      >
        {copied ? <IconCheck size={16} className="text-emerald-400" /> : <IconCopy size={16} />}
      </button>
    </div>
  );
}
