import { describe, it, expect } from "vitest";
import { resolveHref, isAbsoluteUrl, isSafeHref } from "@/app/_lib/markdown-links.mjs";

describe("markdown-links", () => {
  it("sends src/ files to GitHub", () => {
    expect(resolveHref("../../src/members/MemberRegistry.ts", "docs/architecture")).toBe(
      "https://github.com/fworks-tech/agenthood/blob/main/src/members/MemberRegistry.ts",
    );
  });

  it("resolves relative doc pages to routes", () => {
    expect(resolveHref("../adr/ADR-035-skill-namespaces-and-well-known-catalogs.md", "docs/members")).toBe(
      "/adr/ADR-035-skill-namespaces-and-well-known-catalogs/",
    );
  });

  it("resolves directory-relative pages", () => {
    expect(resolveHref("../other-topic/", "docs/architecture")).toBe("/docs/other-topic/");
  });

  it("leaves absolute URLs untouched", () => {
    const url = "https://github.com/fworks-tech/agenthood/pull/272";
    expect(resolveHref(url, "docs/academy")).toBe(url);
    expect(isAbsoluteUrl(url)).toBe(true);
  });

  it("leaves site-absolute paths untouched", () => {
    expect(resolveHref("/docs/foo/", "docs/architecture")).toBe("/docs/foo/");
  });

  it("leaves fragments untouched", () => {
    expect(resolveHref("#heading", "docs/architecture")).toBe("#heading");
  });

  it("blocks javascript:/data: urls from rendering as links", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("mailto:a@b.com")).toBe(true);
    expect(isSafeHref("#heading")).toBe(true);
    expect(isSafeHref("/docs/foo/")).toBe(true);
  });
});
