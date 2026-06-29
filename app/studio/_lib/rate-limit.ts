interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

export function rateLimitHeaders(
  key: string,
  maxRequests: number,
  windowMs: number,
): { "RateLimit-Limit": string; "RateLimit-Remaining": string; "RateLimit-Reset": string } | null {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) return null;
  return {
    "RateLimit-Limit": String(maxRequests),
    "RateLimit-Remaining": String(Math.max(0, maxRequests - entry.count)),
    "RateLimit-Reset": String(Math.ceil((entry.resetAt - now) / 1000)),
  };
}
