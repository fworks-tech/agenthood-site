// Shared resolver for relative markdown links. Used by both the client
// MarkdownRenderer and scripts/check-links.mjs so the checker validates exactly
// what the renderer produces (see issue #331).

export function joinPosix(...parts) {
  return parts
    .map((part) => part.replace(/\/+$/, ""))
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}

export function normalizePosix(input) {
  const parts = input.split("/").filter((p) => p !== "" && p !== ".");
  const stack = [];
  for (const part of parts) {
    if (part === "..") {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return "/" + stack.join("/");
}

export function isAbsoluteUrl(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function isDocsPath(relativePath) {
  return (
    relativePath === "academy" ||
    relativePath.startsWith("academy/") ||
    relativePath === "adr" ||
    relativePath.startsWith("adr/") ||
    relativePath.startsWith("docs/")
  );
}

function rewriteHref(href, basePath) {
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

// Resolve a markdown link exactly as the renderer does.
export function resolveHref(href, basePath = "") {
  if (!href) return href;
  if (href.startsWith("#") || isAbsoluteUrl(href) || href.startsWith("/")) {
    return href;
  }
  return rewriteHref(href, basePath);
}