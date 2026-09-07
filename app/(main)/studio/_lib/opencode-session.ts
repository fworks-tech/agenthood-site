import { randomUUID } from "node:crypto";

const OPENCODE_HOST = "opencode.ai";

function getSessionId(): string {
  return process.env.OPENCODE_SESSION_ID ?? `agenthood-${randomUUID().slice(0, 8)}`;
}

export function patchOpenCodeSession(): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(OPENCODE_HOST)) {
      const headers = new Headers(init?.headers);
      headers.set("x-opencode-session", getSessionId());
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
}
