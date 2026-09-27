import { describe, it, expect } from "vitest";
import {
  CODE_AGENTS,
  DEMO_CODE_MODEL,
  DEMO_PROVIDER,
  DEMO_QA_MODEL,
  CLIENT_MESSAGE_ROLES,
  getMemberTools,
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

describe("Provider", () => {
  it("still enumerates the providers the deprecated ChatConfig shape can hold", () => {
    // The picker is gone and nothing renders these, but ChatConfig keeps the
    // field for localStorage migration, so the union must stay intact.
    expect(ALL_PROVIDERS).toContain(DEMO_PROVIDER);
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

describe("demo pin", () => {
  it("is a single non-empty model id on the pinned provider", () => {
    // Whether the pin actually *works* is a live question, answered by
    // `npm run test:live`. Offline there is only the shape to assert — the old
    // cross-check against PROVIDER_MODELS is gone with the catalogue.
    expect(DEMO_PROVIDER).toBe("opencode");
    expect(DEMO_QA_MODEL).toBeTruthy();
    expect(DEMO_CODE_MODEL).toBeTruthy();
  });

  it("keeps the role allowlist narrow", () => {
    expect([...CLIENT_MESSAGE_ROLES]).toEqual(["user", "assistant"]);
  });
});
