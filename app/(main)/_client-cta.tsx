"use client";

import { useState } from "react";
import { Text } from "@mantine/core";
import { IconCode } from "@tabler/icons-react";
import FadeIn from "../_components/FadeIn";
import TypingTerminal from "../_components/TypingTerminal";

export function ClientCTA() {
  const [terminalVisible, setTerminalVisible] = useState(false);

  return (
    <FadeIn onVisible={() => setTerminalVisible(true)}>
      <section className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-semibold text-white mb-4">Your project deserves a full team.</h2>
            <Text c="dimmed" mb="lg">Open source. No sign-up. Works with any agent runtime.</Text>
            <a
              href="https://github.com/fworks-tech/agenthood"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-zinc-950 font-medium px-8 py-3 rounded-lg hover:bg-zinc-100 transition-colors inline-flex items-center gap-2"
            >
              Get started on GitHub
              <IconCode size={16} />
            </a>
          </div>
          <TypingTerminal startTyping={terminalVisible} />
        </div>
      </section>
    </FadeIn>
  );
}
