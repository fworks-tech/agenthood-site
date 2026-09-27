import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://opencode.ai https://api.anthropic.com https://api.openai.com https://api.groq.com https://openrouter.ai/api https://o4508931134267392.ingest.us.sentry.io",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  // Ship the agenthood trace config into LLM routes: without it, trace
  // persistence falls back to .agenthood/traces under the read-only
  // /var/task on Vercel and every provider call logs an ENOENT error.
  outputFileTracingIncludes: {
    "/api/studio/chat": ["./.agenthood/config.json"],
    "/api/studio/workspaces": ["./.agenthood/config.json"],
    "/api/studio/workspaces/synthesize": ["./.agenthood/config.json"],
  },
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks", "@mantine/form", "@mantine/modals", "@mantine/notifications", "@mantine/nprogress", "@mantine/spotlight", "@mantine/code-highlight"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "fworks",
  project: process.env.SENTRY_PROJECT ?? "agenthood-site",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
}));
