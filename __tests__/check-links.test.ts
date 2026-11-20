import { describe, it, expect } from "vitest";
import { findBrokenLinks, normalize } from "@/scripts/check-links.mjs";

describe("check-links findBrokenLinks", () => {
  const routes = new Set(["/docs/foo/", "/docs/bar/"]);

  it("reports a relative link resolving to a missing route", () => {
    const content = "[x](missing.md)";
    const result = findBrokenLinks(content, "docs", routes);
    expect(result.checked).toBe(1);
    expect(result.broken).toHaveLength(1);
    expect(result.broken[0].target).toBe("/docs/missing/");
  });

  it("does not report a link resolving to an existing route", () => {
    const content = "[x](foo.md)";
    const result = findBrokenLinks(content, "docs", routes);
    expect(result.checked).toBe(1);
    expect(result.broken).toHaveLength(0);
  });

  it("skips external and site-absolute links", () => {
    const content = "[a](https://example.com/x) [b](/docs/foo/) [c](#frag)";
    const result = findBrokenLinks(content, "docs", routes);
    expect(result.checked).toBe(1);
    expect(result.broken).toHaveLength(0);
  });

  it("checks every link on a line (no early exit)", () => {
    const content = "[a](https://example.com/x) [b](missing.md) [c](foo.md)";
    const result = findBrokenLinks(content, "docs", routes);
    expect(result.checked).toBe(2);
    expect(result.broken).toHaveLength(1);
    expect(result.broken[0].href).toBe("missing.md");
  });

  it("normalizes trailing slashes and extensions", () => {
    expect(normalize("/docs/foo")).toBe("/docs/foo/");
    expect(normalize("/docs/foo/")).toBe("/docs/foo/");
    expect(normalize("/news/rss.xml")).toBe("/news/rss.xml");
  });
});