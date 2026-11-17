import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio Playground · Agenthood",
  description: "Chat with any Agenthood member in the browser on a pinned OpenCode Zen model.",
  alternates: { canonical: "/studio/playground/" },
};

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
