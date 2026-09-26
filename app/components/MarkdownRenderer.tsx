"use client";

import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code, Typography } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { Components } from "react-markdown";
import FadeIn from "../_components/FadeIn";
import { childrenToString } from "../_lib/react-children";

interface MarkdownRendererProps {
  children: string;
  basePath?: string;
  animateSections?: boolean;
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

  const hasFileExtension = /[^/]\.[a-zA-Z0-9]+$/.test(relativePath);
  const githubBase = hasFileExtension
    ? "https://github.com/fworks-tech/agenthood/blob/main/"
    : "https://github.com/fworks-tech/agenthood/tree/main/";
  const githubPath = relativePath.endsWith("/")
    ? relativePath.slice(0, -1)
    : relativePath;

  return `${githubBase}${githubPath}${fragment ? `#${fragment}` : ""}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

export default function MarkdownRenderer({ children, basePath = "", animateSections = false }: MarkdownRendererProps) {
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
    h2: ({ children }) => {
      const heading = (
        <h2 id={slugify(childrenToString(children))} className="text-2xl font-semibold text-white mb-3">
          {children}
        </h2>
      );
      return animateSections ? <FadeIn className="mb-6">{heading}</FadeIn> : heading;
    },
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
          <Code color="emerald" className="text-sm">
            {children}
          </Code>
        );
      }
      const codeText = childrenToString(children);
      const language = (className ?? "").replace(/^language-/, "") || "tsx";
      return (
        <div className="mb-4">
          <CodeHighlight
            code={codeText}
            language={language}
            withCopyButton
            withExpandButton
            maxCollapsedHeight={320}
            withBorder
          />
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
    <Typography>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </Typography>
  );
}
