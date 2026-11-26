import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Client/edge read NEXT_PUBLIC_VERCEL_ENV; server reads VERCEL_ENV — same
  // value, different visibility. Keep the split or preview detection breaks.
  tracesSampleRate: process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview" ? 0.05 : 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
