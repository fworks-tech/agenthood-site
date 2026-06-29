"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/getting-started", label: "Getting started" },
  { href: "/studio", label: "Studio" },
  { href: "/academy", label: "Academy" },
  { href: "/releases", label: "Releases" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-white tracking-tight hover:text-zinc-200 transition-colors"
        >
          agenthood
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white border border-zinc-700 px-3 py-1.5 rounded-md hover:border-zinc-500 transition-colors"
          >
            GitHub →
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden text-zinc-400 hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-zinc-800 px-6 py-4 space-y-3 bg-zinc-950">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block text-zinc-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            GitHub →
          </a>
        </div>
      )}
    </nav>
  );
}
