import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio Workspaces · Agenthood",
  description: "Assemble a team of Agenthood members, give one instruction, and watch them collaborate.",
  alternates: { canonical: "/studio/workspaces/" },
};

export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
