const OPENCODE_HOST = "opencode.ai";

// Stable per process: the gateway pins requests sharing a session to one
// backend for prompt-cache affinity. As of agenthood 3.56 the upstream
// OpenCodeProvider sets x-opencode-session to a fresh randomUUID per request
// (which satisfies the gateway's MissingSessionID requirement but defeats
// affinity), so we override it with the process-stable id on the way out.
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
      headers.set("x-opencode-session", SESSION_ID);
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;
}
