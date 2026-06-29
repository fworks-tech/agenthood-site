import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/studio/chat": { max: 20, windowMs: 60_000 },
  "/api/studio/agents": { max: 60, windowMs: 60_000 },
  "/api/studio/status": { max: 30, windowMs: 60_000 },
};

const store = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const limits = RATE_LIMITS[pathname];
  if (!limits) return NextResponse.next();

  cleanup();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const key = `${pathname}:${ip}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + limits.windowMs });
    return NextResponse.next();
  }

  if (entry.count >= limits.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new NextResponse(
      JSON.stringify({ error: "Too many requests. Please slow down.", code: "RATE_LIMITED", retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "RateLimit-Limit": String(limits.max),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": String(retryAfter),
        },
      },
    );
  }

  entry.count++;

  const remaining = limits.max - entry.count;
  const response = NextResponse.next();
  response.headers.set("RateLimit-Limit", String(limits.max));
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil((entry.resetAt - now) / 1000)));
  return response;
}

export const config = {
  matcher: ["/api/studio/:path*"],
};
