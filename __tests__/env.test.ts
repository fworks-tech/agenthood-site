import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMaxTokens } from "../app/(main)/studio/_lib/env";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getMaxTokens", () => {
  it("defaults to 4096 when AGENTHOOD_MAX_TOKENS is not set", () => {
    delete process.env.AGENTHOOD_MAX_TOKENS;
    expect(getMaxTokens()).toBe(4096);
  });

  it("reads a valid positive value from AGENTHOOD_MAX_TOKENS", () => {
    process.env.AGENTHOOD_MAX_TOKENS = "8192";
    expect(getMaxTokens()).toBe(8192);
  });

  it("falls back to 4096 for non-numeric values", () => {
    process.env.AGENTHOOD_MAX_TOKENS = "lots";
    expect(getMaxTokens()).toBe(4096);
  });

  it("falls back to 4096 for zero or negative values", () => {
    process.env.AGENTHOOD_MAX_TOKENS = "0";
    expect(getMaxTokens()).toBe(4096);
    process.env.AGENTHOOD_MAX_TOKENS = "-100";
    expect(getMaxTokens()).toBe(4096);
  });
});