import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { patchOpenCodeSession } = await import(
      "./app/(main)/studio/_lib/opencode-session"
    );
    patchOpenCodeSession();
    await import("./sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
