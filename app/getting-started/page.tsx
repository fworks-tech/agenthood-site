import fs from "node:fs";
import path from "node:path";
import Navbar from "../components/Navbar";
import MarkdownRenderer from "../components/MarkdownRenderer";

const MARKDOWN_PATH = path.join(process.cwd(), "content", "academy", "getting-started.md");

function getMarkdown(): string {
  try {
    return fs.readFileSync(MARKDOWN_PATH, "utf8");
  } catch {
    return "Failed to load content. Please run `npm run sync` first.";
  }
}

export default function GettingStarted() {
  const markdown = getMarkdown();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <MarkdownRenderer basePath="academy">{markdown}</MarkdownRenderer>
      </div>
    </main>
  );
}
