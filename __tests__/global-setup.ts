// Pays the cold-start cost of the route module graphs once per run, before any
// test is timed.
//
// The route tests each begin with `await import(".../route")`, and because they
// call `vi.resetModules()` in `beforeEach` that re-import is load-bearing: it
// re-evaluates the route so each test sees a fresh module. The first one, though,
// also pays Vite's first transform of the whole route graph — agenthood,
// Mantine, Sentry, the adapter — and on a cold cache that runs past
// `testTimeout`, so the first test in every route file fails while the other
// sixteen pass.
//
// A `globalSetup` is the one hook that runs exactly once, in the main process,
// outside any test or hook timeout, and it shares Vite's transform cache with
// the workers. That warms the expensive half (the transform) while leaving
// `vi.resetModules()` to keep doing the cheap half (per-test evaluation) exactly
// as before.
//
// A `setupFiles` warm was tried first and reverted: it runs once per test file,
// so it taxed all fifty and merely moved the failures onto the skill-loading
// tests.
//
// This changes no test, no timeout, and no isolation. A genuinely slow test
// still fails at 10s; only the transform moves.
const ROUTES = [
  "../app/api/studio/chat/route",
  "../app/api/studio/tools/execute/route",
];

export default async function warmRouteModules() {
  for (const route of ROUTES) {
    await import(route);
  }
}
