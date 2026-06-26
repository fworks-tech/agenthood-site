import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import Navbar from "../components/Navbar";
import MarkdownRenderer from "../components/MarkdownRenderer";

const RELEASE_NOTES_PATH = path.join(process.cwd(), "content", "release-notes.md");

function getReleaseNotes(): string {
  try {
    return fs.readFileSync(RELEASE_NOTES_PATH, "utf8");
  } catch {
    return "Failed to load release notes. Please run `npm run sync` first.";
  }
}

export default function Releases() {
  const markdown = getReleaseNotes();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />

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

        <MarkdownRenderer>{markdown}</MarkdownRenderer>

        <footer className="border-t border-zinc-800 pt-8 mt-16 flex items-center justify-between text-sm text-zinc-600">
          <span className="flex items-center gap-3">
            <span>
              agenthood · by{" "}
              <a href="https://flabs.tech" className="hover:text-zinc-400 transition-colors">
                Fabio Ritzel Borges
              </a>
            </span>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
              v3.0.0
            </span>
          </span>
          <Link
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
          >
            GitHub
          </Link>
        </footer>
      </div>
    </main>
  );
}
