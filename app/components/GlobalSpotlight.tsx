"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Spotlight, spotlight } from "@mantine/spotlight";
import {
  IconHome,
  IconRocket,
  IconBook,
  IconSchool,
  IconNews,
  IconPackage,
  IconFlask,
  IconUsers,
  IconBrandGithub,
} from "@tabler/icons-react";
import { agents } from "../(main)/studio/_data/agents";

export const PENDING_AGENT_KEY = "agenthood-pending-agent";

const PAGES = [
  { id: "page-home", title: "Home", description: "Agenthood overview", href: "/", icon: <IconHome size={16} /> },
  { id: "page-getting-started", title: "Getting started", description: "Setup in ~2 minutes", href: "/getting-started", icon: <IconRocket size={16} /> },
  { id: "page-docs", title: "Docs", description: "Documentation", href: "/docs", icon: <IconBook size={16} /> },
  { id: "page-academy", title: "Academy", description: "Learn the Society", href: "/academy", icon: <IconSchool size={16} /> },
  { id: "page-news", title: "News", description: "Updates and digests", href: "/news", icon: <IconNews size={16} /> },
  { id: "page-releases", title: "Releases", description: "Changelog", href: "/releases", icon: <IconPackage size={16} /> },
  { id: "page-playground", title: "Studio Playground", description: "Chat with agents live", href: "/studio/playground", icon: <IconFlask size={16} /> },
  { id: "page-workspaces", title: "Studio Workspaces", description: "Multi-agent collaboration", href: "/studio/workspaces", icon: <IconUsers size={16} /> },
];

export function openGlobalSpotlight() {
  spotlight.open();
}

export default function GlobalSpotlight() {
  const router = useRouter();

  const actions = useMemo(
    () => [
      {
        group: "Pages",
        actions: PAGES.map((p) => ({
          id: p.id,
          label: p.title,
          description: p.description,
          leftSection: p.icon,
          onClick: () => router.push(p.href),
        })),
      },
      {
        group: "Agents",
        actions: agents
          .filter((a) => a.enabled)
          .map((a) => ({
            id: `agent-${a.id}`,
            label: `${a.icon ?? ""} ${a.name}`.trim(),
            description: a.role,
            keywords: [a.id, a.category, ...(a.stage ?? [])],
            onClick: () => {
              try {
                sessionStorage.setItem(PENDING_AGENT_KEY, a.id);
              } catch {
                // private mode — playground just opens without preselection
              }
              router.push("/studio/playground");
            },
          })),
      },
      {
        group: "External",
        actions: [
          {
            id: "ext-github",
            label: "GitHub repository",
            description: "fworks-tech/agenthood",
            leftSection: <IconBrandGithub size={16} />,
            onClick: () => window.open("https://github.com/fworks-tech/agenthood", "_blank", "noopener"),
          },
        ],
      },
    ],
    [router],
  );

  return (
    <Spotlight
      actions={actions}
      shortcut={["mod + K", "mod + P", "/"]}
      searchProps={{ placeholder: "Search pages and agents..." }}
      nothingFound="Nothing found..."
      highlightQuery
      scrollable
      limit={12}
    />
  );
}
