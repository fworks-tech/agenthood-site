// Shared by sync-docs, generate-news-digest and build-news-manifest.
// buildSlug is intentionally NOT unified: sync-docs maps a file path to a
// slug array while the news scripts map a date string to a slug string.
export function titleFromMarkdown(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith("# "));
  return line ? line.trim().replace(/^#\s+/, "") : "";
}
