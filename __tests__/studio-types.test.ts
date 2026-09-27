import { describe, it, expect } from "vitest";
import {
  CODE_AGENTS,
  DEMO_CODE_MODEL,
  DEMO_PROVIDER,
  DEMO_QA_MODEL,
  PROVIDER_MODELS,
  getDefaultModel,
  getMemberTools,
  getProviderMeta,
  type Provider,
} from "../app/(main)/studio/_types/studio";
import { getToolSchemas } from "../app/(main)/studio/_lib/tools";
import { agentRegistry } from "../app/(main)/studio/_data/registry.generated";

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
  it("contains the nine code-capable members", () => {
    expect(CODE_AGENTS).toEqual(
      new Set([
        "the-architect",
        "the-builder",
        "the-reviewer",
        "the-tester",
        "the-debugger",
        "the-warden",
        "the-auditor",
        "the-doorman",
        "the-operator",
      ]),
    );
  });

  it("excludes every prose-lane member", () => {
    const prose = agentRegistry.map((m) => m.name).filter((n) => !CODE_AGENTS.has(n));
    expect(prose.length).toBe(11);
    for (const id of prose) expect(CODE_AGENTS.has(id)).toBe(false);
  });
});

describe("getMemberTools", () => {
  it("grants the code_execution sandbox to code-lane members", () => {
    for (const id of ["the-architect", "the-builder", "the-tester"]) {
      expect(getMemberTools(id)).toEqual(["web_fetch", "activate_skill", "code_execution"]);
    }
  });

  it("withholds code_execution from prose-lane members", () => {
    for (const id of ["the-scribe", "the-herald", "the-librarian", "the-mediator"]) {
      expect(getMemberTools(id)).toEqual(["web_fetch", "activate_skill"]);
    }
  });

  it("fails safe for an unknown member", () => {
    expect(getMemberTools("not-a-member")).toEqual(["web_fetch", "activate_skill"]);
  });

  it("only ever grants tools that actually exist", () => {
    for (const member of agentRegistry.map((m) => m.name)) {
      for (const tool of getMemberTools(member)) {
        expect(getToolSchemas().map((s) => s.name)).toContain(tool);
      }
    }
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
describe("demo pin", () => {
  it("targets a model that exists on the pinned provider", () => {
    const models = PROVIDER_MODELS[DEMO_PROVIDER].models.map((m) => m.id);
  });

  it("targets tier models that exist on the pinned provider", () => {
    const models = PROVIDER_MODELS[DEMO_PROVIDER].models.map((m) => m.id);
    expect(models).toContain(DEMO_QA_MODEL);
    expect(models).toContain(DEMO_CODE_MODEL);
  });
});
