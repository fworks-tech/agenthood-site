"use client";

import React, { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs border border-zinc-700/50"
      aria-label="Copy code"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      )}
    </button>
  );
}

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
    relativePath.startsWith("docs/")
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
    let sitePath = relativePath;
    if (sitePath.startsWith("docs/academy/") || sitePath === "docs/academy") {
      sitePath = sitePath.slice(5);
    } else if (sitePath.startsWith("docs/adr/") || sitePath === "docs/adr") {
      sitePath = sitePath.slice(5);
    }
    sitePath = sitePath.replace(/\.md$/i, "").replace(/\/+$/, "");

    if (sitePath.endsWith("/SKILL")) {
      sitePath = sitePath.slice(0, -"/SKILL".length);
    } else if (sitePath.endsWith("/README")) {
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
      <h1 id={slugify(childrenToString(children))} className="text-3xl font-semibold text-white mb-4">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 id={slugify(childrenToString(children))} className="text-2xl font-semibold text-white mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 id={slugify(childrenToString(children))} className="text-lg font-semibold text-white mt-8 mb-3">
        {children}
      </h3>
    ),
    p: ({ children }) => {
      const insertBreaks = (nodes: React.ReactNode): React.ReactNode[] =>
        React.Children.toArray(nodes).reduce<React.ReactNode[]>((acc, child, i) => {
          if (typeof child === 'string' && child.includes('\n')) {
            child.split(/(\n)/).forEach((part, j) => {
              if (part === '\n') {
                acc.push(<br key={`${i}-${j}`} />);
              } else {
                acc.push(part);
              }
            });
          } else if (typeof child === 'object' && child !== null && 'props' in child) {
            const el = child as React.ReactElement<{ children?: React.ReactNode }>;
            acc.push(React.cloneElement(el, {
              children: insertBreaks(el.props.children),
            }));
          } else {
            acc.push(child);
          }
          return acc;
        }, []);
      return <p className="text-zinc-300 leading-relaxed mb-4">{insertBreaks(children)}</p>;
    },
    ul: ({ children }) => <ul className="list-disc space-y-1.5 text-zinc-300 ml-6 mb-4">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1.5 text-zinc-300 ml-6 mb-4">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    a: MarkdownLink,
    code: ({ children, className }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-zinc-800/70 text-emerald-400 px-1.5 py-0.5 rounded-md text-sm font-mono border border-zinc-700/50">
            {children}
          </code>
        );
      }
      const codeText = childrenToString(children);
      return (
        <div className="group relative mb-4">
          <pre className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-xl p-5 overflow-x-auto shadow-inner">
            <code className="text-sm font-mono text-zinc-200 leading-relaxed">{children}</code>
          </pre>
          <CopyButton text={codeText} />
        </div>
      );
    },
    br: () => <br />,
    hr: () => <hr className="border-zinc-800/60 my-10" />,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-emerald-500/50 bg-zinc-800/30 pl-5 pr-4 py-3.5 text-zinc-400 mb-6 last:mb-0 rounded-r-lg">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
    table: ({ children }) => (
      <div className="mb-6 overflow-x-auto rounded-lg border border-zinc-800/80">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-zinc-900/80">{children}</thead>,
    th: ({ children }) => (
      <th className="text-left text-zinc-400 font-medium px-4 py-2.5 border-b border-zinc-800/80">{children}</th>
    ),
    td: ({ children }) => <td className="px-4 py-2.5 text-zinc-300 border-b border-zinc-800/40">{children}</td>,
    tr: ({ children }) => <tr className="hover:bg-zinc-800/20 transition-colors">{children}</tr>,
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
