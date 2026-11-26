import { describe, it, expect } from "vitest";
import { titleFromMarkdown } from "../scripts/lib/markdown.mjs";

describe("titleFromMarkdown", () => {
  it("returns the first h1 without the marker", () => {
    expect(titleFromMarkdown("# Hello\n\nbody")).toBe("Hello");
  });

  it("handles CRLF line endings", () => {
    expect(titleFromMarkdown("---\r\ntitle: x\r\n---\r\n# Digest\r\nbody")).toBe("Digest");
  });

  it("returns empty string when there is no h1", () => {
    expect(titleFromMarkdown("## Sub\n\nbody")).toBe("");
  });
});
