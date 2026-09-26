"use client";

import Link from "next/link";
import { useCallback } from "react";
import { track } from "@vercel/analytics";
import { Button, Group, Badge, Burger, Drawer, Stack, ActionIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { openGlobalSpotlight } from "./GlobalSpotlight";
import HelpTip from "../(main)/studio/_components/HelpTip";

interface NavLink {
  href: string;
  label: string;
  highlight?: boolean;
}

const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/getting-started", label: "Getting started" },
  { href: "/docs", label: "Docs" },
  { href: "/academy", label: "Academy" },
  { href: "/news", label: "News" },
  { href: "/releases", label: "Releases" },
  { href: "/studio", label: "Studio", highlight: true },
];

export default function Navbar() {
  const [menuOpen, { toggle: toggleMenu, close: closeMenu }] = useDisclosure(false);
  const trackNav = useCallback((label: string) => {
    track("nav_click", { target: label.toLowerCase() });
  }, []);

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-white tracking-tight hover:text-zinc-200 transition-colors"
        >
          agenthood
        </Link>

        <Group visibleFrom="md" gap="lg" c="dimmed" fz="sm">
          {navLinks.map((link) =>
            link.highlight ? (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => trackNav(link.label)}
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                {link.label}
                <Badge
                  size="xs"
                  variant="outline"
                  color="emerald"
                  rightSection={
                    <HelpTip text="Agenthood Studio was recently added. Chat with agents live in your browser." side="top" />
                  }
                  styles={{ label: { textTransform: "uppercase", letterSpacing: "0.05em" } }}
                >
                  New
                </Badge>
              </Link>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => trackNav(link.label)}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
          <Button
            component="a"
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            color="gray"
            size="sm"
            onClick={() => trackNav("github")}
          >
            GitHub →
          </Button>
          <ActionIcon
            variant="outline"
            color="gray"
            size="lg"
            onClick={openGlobalSpotlight}
            aria-label="Search pages and agents (Ctrl+K)"
            title="Search pages and agents (Ctrl+K)"
          >
            <IconSearch size={16} />
          </ActionIcon>
        </Group>

        <Group hiddenFrom="md" gap="xs">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={openGlobalSpotlight}
            aria-label="Search pages and agents"
          >
            <IconSearch size={18} />
          </ActionIcon>
          <Burger
            opened={menuOpen}
            onClick={toggleMenu}
            color="gray"
            aria-label="Toggle menu"
          />
        </Group>
      </div>

      <Drawer
        opened={menuOpen}
        onClose={closeMenu}
        size="xs"
        padding="md"
        hiddenFrom="md"
        title={
          <Link href="/" className="font-semibold text-white tracking-tight">
            agenthood
          </Link>
        }
      >
        <Stack gap="sm">
          {navLinks.map((link) =>
            link.highlight ? (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => { trackNav(link.label); closeMenu(); }}
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                {link.label}
                <Badge
                  size="xs"
                  variant="outline"
                  color="emerald"
                  rightSection={
                    <HelpTip text="Agenthood Studio was recently added. Chat with agents live in your browser." side="top" />
                  }
                  styles={{ label: { textTransform: "uppercase", letterSpacing: "0.05em" } }}
                >
                  New
                </Badge>
              </Link>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => { trackNav(link.label); closeMenu(); }}
                className="block text-zinc-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
          <Button
            component="a"
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            color="emerald"
            fullWidth
            onClick={() => { trackNav("github"); closeMenu(); }}
          >
            GitHub →
          </Button>
        </Stack>
      </Drawer>
    </nav>
  );
}
