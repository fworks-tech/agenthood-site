export class StudioError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "StudioError";
  }
}

export class AgentNotFoundError extends StudioError {
  constructor(agentId: string) {
    super(`Agent "${agentId}" not found.`, "AGENT_NOT_FOUND", 404);
    this.name = "AgentNotFoundError";
  }
}

export class ValidationError extends StudioError {
  constructor(detail: string) {
    super(`Validation error: ${detail}`, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}
