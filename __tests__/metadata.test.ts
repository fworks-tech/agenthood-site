import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
}));

import { metadata as rootMetadata } from "../app/layout";
import { metadata as homeMetadata } from "../app/(main)/page";
import { generateMetadata as docsMetadata } from "../app/(main)/docs/[[...slug]]/page";
import { generateMetadata as academyMetadata } from "../app/(main)/academy/[[...slug]]/page";
import { generateMetadata as adrMetadata } from "../app/(main)/adr/[[...slug]]/page";

function canonical(metadata: Metadata): string | undefined {
  const value = metadata.alternates?.canonical;
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : value.toString();
}

describe("per-route canonical URLs", () => {
  it("does not canonicalize every route to the homepage", () => {
    expect(canonical(rootMetadata)).toBeUndefined();
  });

  it("gives the homepage its own canonical", () => {
    expect(canonical(homeMetadata)).toBe("/");
  });

  it("derives a canonical from the content slug", async () => {
    expect(
      canonical(await docsMetadata({ params: Promise.resolve({ slug: ["architecture", "skills"] }) })),
    ).toBe("/docs/architecture/skills/");
    expect(
      canonical(await academyMetadata({ params: Promise.resolve({ slug: ["getting-started"] }) })),
    ).toBe("/academy/getting-started/");
    expect(
      canonical(await adrMetadata({ params: Promise.resolve({ slug: ["ADR-001-markdown-skills-over-code-agents"] }) })),
    ).toBe("/adr/ADR-001-markdown-skills-over-code-agents/");
  });

  it("keeps section indexes at the section URL", async () => {
    expect(canonical(await docsMetadata({ params: Promise.resolve({ slug: [] }) }))).toBe("/docs/");
    expect(canonical(await academyMetadata({ params: Promise.resolve({ slug: [] }) }))).toBe("/academy/");
    expect(canonical(await adrMetadata({ params: Promise.resolve({ slug: [] }) }))).toBe("/adr/");
  });
});
