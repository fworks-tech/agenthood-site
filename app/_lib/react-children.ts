import type { ReactNode } from "react";

/**
 * Flattens a react-markdown children tree back to its raw text.
 *
 * react-markdown hands renderers a ReactNode tree, but CodeHighlight wants a
 * string. Shared here because three renderers need the same walk: the docs
 * MarkdownRenderer (heading slug ids) and the Studio MessageBubble and
 * WorkspaceTurnCard (code block bodies).
 */
export function childrenToString(node: ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childrenToString).join("");
  if (typeof node === "object" && "props" in node) {
    return childrenToString((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}
