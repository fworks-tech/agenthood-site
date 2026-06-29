import { describe, it, expect } from "vitest";
import { StudioError, AgentNotFoundError, ValidationError } from "../app/(main)/studio/_lib/errors";

describe("StudioError", () => {
  it("sets message, code, and statusCode", () => {
    const err = new StudioError("test", "TEST_CODE", 400);
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("StudioError");
  });

  it("defaults statusCode to 500", () => {
    const err = new StudioError("test", "TEST");
    expect(err.statusCode).toBe(500);
  });
});

describe("AgentNotFoundError", () => {
  it("has status 404 and AGENT_NOT_FOUND code", () => {
    const err = new AgentNotFoundError("the-architect");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("AGENT_NOT_FOUND");
    expect(err.message).toContain("the-architect");
  });

  it("is instance of StudioError", () => {
    expect(new AgentNotFoundError("x")).toBeInstanceOf(StudioError);
  });
});

describe("ValidationError", () => {
  it("has status 400 and VALIDATION_ERROR code", () => {
    const err = new ValidationError("agentId is required");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toContain("agentId is required");
  });

  it("is instance of StudioError", () => {
    expect(new ValidationError("x")).toBeInstanceOf(StudioError);
  });
});
