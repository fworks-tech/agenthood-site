"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  children: string;
  basePath?: string;
}

function joinPosix(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/\/+$/, ""))
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}

function normalizePosix(input: string): string {
  const parts = input.split("/").filter((p) => p !== "" && p !== ".");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return "/" + stack.join("/");
}

function isAbsoluteUrl(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function isDocsPath(relativePath: string): boolean {
  return (
    relativePath === "academy" ||
    relativePath.startsWith("academy/") ||
    relativePath === "adr" ||
    relativePath.startsWith("adr/") ||
    relativePath.startsWith("docs/academy/") ||
    relativePath.startsWith("docs/adr/")
  );
}

function rewriteHref(href: string, basePath: string): string {
  if (!href || href.startsWith("#") || isAbsoluteUrl(href) || href.startsWith("/")) {
    return href;
  }

  const [pathPart, fragment] = href.split("#");
  const joined = basePath ? joinPosix(basePath, pathPart) : pathPart;
  const normalized = normalizePosix(joined);
  const relativePath = normalized.replace(/^\/+/, "");

  if (isDocsPath(relativePath)) {
    let sitePath = relativePath.startsWith("docs/")
      ? relativePath.slice(5)
      : relativePath;
    sitePath = sitePath.replace(/\.md$/i, "").replace(/\/+$/, "");

    if (sitePath.endsWith("/README")) {
      sitePath = sitePath.slice(0, -"/README".length);
    } else if (sitePath === "README") {
      sitePath = "";
    }

    const route = "/" + (sitePath ? `${sitePath}/` : "");
    return fragment ? `${route}#${fragment}` : route;
  }

  // Non-docs relative links point to the source repository.
  const hasFileExtension = /[^/]\.[a-zA-Z0-9]+$/.test(relativePath);
  const githubBase = hasFileExtension
    ? "https://github.com/fworks-tech/agenthood/blob/main/"
    : "https://github.com/fworks-tech/agenthood/tree/main/";
  const githubPath = relativePath.endsWith("/")
    ? relativePath.slice(0, -1)
    : relativePath;

  return `${githubBase}${githubPath}${fragment ? `#${fragment}` : ""}`;
}

function childrenToString(children: React.ReactNode): string {
  if (children === null || children === undefined) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  if (typeof children === "object" && "props" in children) {
    return childrenToString((children as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return "";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

export default function MarkdownRenderer({ children, basePath = "" }: MarkdownRendererProps) {
  const MarkdownLink: Components["a"] = ({ href, children }) => {
    if (!href) {
      return <a className="text-emerald-400 hover:text-emerald-300 transition-colors">{children}</a>;
    }

    if (isAbsoluteUrl(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {children}
        </a>
      );
    }

    const rewritten = href.startsWith("/") ? href : rewriteHref(href, basePath);
    return (
      <Link href={rewritten} className="text-emerald-400 hover:text-emerald-300 transition-colors">
        {children}
      </Link>
    );
  };

  const components: Components = {
    h1: ({ children }) => (
      <h1 id={slugify(childrenToString(children))} className="text-3xl font-semibold text-white mt-10 mb-4">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 id={slugify(childrenToString(children))} className="text-2xl font-semibold text-white mt-10 mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 id={slugify(childrenToString(children))} className="text-lg font-semibold text-white mt-6 mb-2">
        {children}
      </h3>
    ),
    p: ({ children }) => <p className="text-zinc-300 leading-relaxed mb-4">{children}</p>,
    ul: ({ children }) => <ul className="list-disc space-y-1.5 text-zinc-300 ml-6 mb-4">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1.5 text-zinc-300 ml-6 mb-4">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    a: MarkdownLink,
    code: ({ children, className }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto mb-4">
          <code className="text-sm font-mono text-zinc-300">{children}</code>
        </pre>
      );
    },
    hr: () => <hr className="border-zinc-800 my-8" />,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-zinc-700 pl-4 italic text-zinc-400 mb-4">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
    table: ({ children }) => <table className="w-full text-sm mb-4 border-collapse">{children}</table>,
    thead: ({ children }) => <thead className="border-b border-zinc-800">{children}</thead>,
    th: ({ children }) => (
      <th className="text-left text-zinc-400 font-medium py-2 pr-4">{children}</th>
    ),
    td: ({ children }) => <td className="py-2 pr-4 text-zinc-300">{children}</td>,
    tr: ({ children }) => <tr className="border-b border-zinc-800/50 last:border-b-0">{children}</tr>,
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
