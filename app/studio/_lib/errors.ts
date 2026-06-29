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

export class ProviderUnavailableError extends StudioError {
  constructor(provider: string) {
    super(
      `Provider "${provider}" is not configured. Set the corresponding API key in environment variables.`,
      "PROVIDER_UNAVAILABLE",
      503,
    );
    this.name = "ProviderUnavailableError";
  }
}

export class AgentNotFoundError extends StudioError {
  constructor(agentId: string) {
    super(`Agent "${agentId}" not found.`, "AGENT_NOT_FOUND", 404);
    this.name = "AgentNotFoundError";
  }
}

export class RateLimitError extends StudioError {
  constructor(retryAfter: number) {
    super("Too many requests. Please slow down.", "RATE_LIMITED", 429);
    this.name = "RateLimitError";
    this.headers = { "Retry-After": String(retryAfter) };
  }
  headers: Record<string, string>;
}

export class ValidationError extends StudioError {
  constructor(detail: string) {
    super(`Validation error: ${detail}`, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}
