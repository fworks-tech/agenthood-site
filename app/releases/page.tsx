import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const RAW_URL = "https://raw.githubusercontent.com/fworks-tech/agenthood/v2.0.x/docs/release-notes.md";

async function getReleaseNotes(): Promise<string> {
  const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch release notes");
  return res.text();
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-semibold text-white mt-10 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-white mt-10 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-white mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-zinc-300 leading-relaxed mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 text-zinc-300 ml-6 mb-4">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="list-disc">{children}</li>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return <code className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
    }
    return (
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto mb-4">
        <code className="text-sm font-mono text-zinc-300">{children}</code>
      </pre>
    );
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors">
      {children}
    </a>
  ),
  hr: () => <hr className="border-zinc-800 my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-zinc-700 pl-4 italic text-zinc-400 mb-4">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
};

export default async function Releases() {
  let markdown: string;
  try {
    markdown = await getReleaseNotes();
  } catch {
    markdown = "Failed to load release notes. Please try again later.";
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-semibold text-white tracking-tight">agenthood</Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
          <Link href="/getting-started" className="hover:text-white transition-colors">Getting started</Link>
          <Link href="/academy" className="hover:text-white transition-colors">Academy</Link>
          <a
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white border border-zinc-700 px-3 py-1.5 rounded-md hover:border-zinc-500 transition-colors"
          >
            GitHub →
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-2">
          Release Notes
        </h1>
        <p className="text-zinc-400 mb-10">
          Full version history for Agenthood.{" "}
          <a
            href="https://github.com/fworks-tech/agenthood/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View on GitHub ↗
          </a>
        </p>

        <div className="prose-custom">
          <ReactMarkdown components={markdownComponents}>
            {markdown}
          </ReactMarkdown>
        </div>

        <footer className="border-t border-zinc-800 pt-8 mt-16 flex items-center justify-between text-sm text-zinc-600">
          <span className="flex items-center gap-3">
            <span>
              agenthood · by{" "}
              <a href="https://flabs.tech" className="hover:text-zinc-400 transition-colors">
                Fabio Ritzel Borges
              </a>
            </span>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">v2.0.0</span>
          </span>
          <a href="https://github.com/fworks-tech/agenthood" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
