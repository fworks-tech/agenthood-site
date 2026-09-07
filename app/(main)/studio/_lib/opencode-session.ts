const OPENCODE_HOST = "opencode.ai";

// Stable per process: the gateway pins requests sharing a session to one
// backend for prompt-cache affinity. A random ID per request defeats this.
const SESSION_ID = process.env.OPENCODE_SESSION_ID ?? "agenthood-site";

let patched = false;

export function patchOpenCodeSession(): void {
  if (patched) return;
  patched = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url?.includes(OPENCODE_HOST)) {
      const headers = new Headers(init?.headers);
      if (!headers.has("x-opencode-session")) {
        headers.set("x-opencode-session", SESSION_ID);
      }
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;
}
