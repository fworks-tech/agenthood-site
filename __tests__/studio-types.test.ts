import { describe, it, expect } from "vitest";
import {
  CODE_AGENTS,
  PROVIDER_MODELS,
  getDefaultModel,
  getProviderMeta,
  type Provider,
} from "../app/(main)/studio/_types/studio";

const ALL_PROVIDERS: Provider[] = [
  "anthropic",
  "openai",
  "groq",
  "ollama",
  "opencode",
  "opencode-go",
  "openrouter",
];

describe("PROVIDER_MODELS catalog", () => {
  it("defines every supported provider", () => {
    expect(Object.keys(PROVIDER_MODELS).sort()).toEqual([...ALL_PROVIDERS].sort());
  });

  it("gives every provider a label and at least one model", () => {
    for (const p of ALL_PROVIDERS) {
      const meta = PROVIDER_MODELS[p];
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.models.length).toBeGreaterThan(0);
    }
  });

  it("keeps model ids unique within each provider", () => {
    for (const p of ALL_PROVIDERS) {
      const ids = PROVIDER_MODELS[p].models.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives self-hosted providers a default base URL", () => {
    for (const p of ALL_PROVIDERS) {
      if (PROVIDER_MODELS[p].requiresBaseUrl) {
        expect(PROVIDER_MODELS[p].defaultBaseUrl).toBeTruthy();
      }
    }
  });

  it("marks cloud providers as requiring a key and no base URL", () => {
    for (const p of ["anthropic", "openai", "groq", "openrouter"] as Provider[]) {
      expect(PROVIDER_MODELS[p].requiresKey).toBe(true);
      expect(PROVIDER_MODELS[p].requiresBaseUrl).toBe(false);
    }
    for (const p of ["ollama", "opencode", "opencode-go"] as Provider[]) {
      expect(PROVIDER_MODELS[p].requiresKey).toBe(false);
      expect(PROVIDER_MODELS[p].requiresBaseUrl).toBe(true);
    }
  });
});

describe("CODE_AGENTS", () => {
  it("contains the five code-capable members", () => {
    expect(CODE_AGENTS).toEqual(
      new Set(["the-architect", "the-reviewer", "the-tester", "the-debugger", "the-warden"]),
    );
  });
});

describe("getProviderMeta", () => {
  it.each(ALL_PROVIDERS)("resolves metadata for %s", (p) => {
    expect(getProviderMeta(p)).toBe(PROVIDER_MODELS[p]);
  });
});

describe("getDefaultModel", () => {
  it.each(ALL_PROVIDERS)("returns the first listed model for %s", (p) => {
    expect(getDefaultModel(p)).toBe(PROVIDER_MODELS[p].models[0].id);
  });

  it("falls back to deepseek-v4-flash for unknown providers", () => {
    expect(getDefaultModel("not-a-provider" as Provider)).toBe("deepseek-v4-flash");
  });
});