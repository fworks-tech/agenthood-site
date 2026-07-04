# Real-User Performance Monitoring with Vercel Speed Insights

**Date:** July 4, 2026  
**Author:** Agenthood Team

We've added **Vercel Speed Insights** to agenthood.flabs.tech — a real-user monitoring (RUM) service that captures Core Web Vitals from actual visitors.

## What It Measures

Speed Insights tracks four key metrics for every page load:

| Metric | What it measures | Good target |
|--------|-----------------|-------------|
| **LCP** (Largest Contentful Paint) | Loading performance — when the main content renders | ≤ 2.5s |
| **CLS** (Cumulative Layout Shift) | Visual stability — unexpected layout shifts | ≤ 0.1 |
| **INP** (Interaction to Next Paint) | Interactivity — response to user clicks/taps | ≤ 200ms |
| **TTFB** (Time to First Byte) | Server response time | ≤ 800ms |

## How It Works

The `@vercel/speed-insights` package injects a tiny `<SpeedInsights />` component into the root layout. It collects anonymized performance data from real users and surfaces it in the Vercel dashboard alongside existing Analytics data.

There's no configuration, no impact on page load (loaded asynchronously), and no consent banner needed — the data is fully anonymized and aggregated.

## What's Next

With Speed Insights in place, we can:

- **Detect regressions** — a PR that degrades LCP by 500ms will show up in the dashboard
- **Compare routes** — the Studio playground vs. Docs vs. the landing page
- **Set budgets** — add performance budgets to CI so builds fail on regressions
- **Correlate with errors** — cross-reference Sentry error spikes with performance degradation

## Related

- [Vercel Speed Insights Documentation](https://vercel.com/docs/speed-insights)
- [Core Web Vitals — web.dev](https://web.dev/vitals/)
