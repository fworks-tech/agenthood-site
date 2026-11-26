import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Server runtime reads VERCEL_ENV (client/edge use the NEXT_PUBLIC_ twin).
  tracesSampleRate: process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview" ? 0.05 : 0,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
});
