import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ALLOWED_ORIGINS = process.env.NODE_ENV === "development"
  ? ["http://localhost:3000", "http://127.0.0.1:3000"]
  : ["https://agenthood.flabs.tech"];

function validateOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) return;
  const raw = origin ?? referer ?? "";
  let source: string;
  try {
    source = new URL(raw).origin;
  } catch {
    console.warn("middleware.origin_parse_failed", { raw });
    throw new Error("Cross-origin request rejected");
  }
  const allowed = ALLOWED_ORIGINS.some((o) => source === o);
  if (!allowed) {
    console.warn("middleware.cors_rejected", { source, pathname: request.nextUrl.pathname });
    throw new Error("Cross-origin request rejected");
  }
}

type RateLimits = Record<string, { max: number; windowMs: number }>;

const RATE_LIMITS: RateLimits = {
  "/api/studio/chat": { max: 20, windowMs: 60_000 },
  "/api/studio/agents": { max: 60, windowMs: 60_000 },
  "/api/studio/status": { max: 30, windowMs: 60_000 },
  "/api/studio/feedback": { max: 60, windowMs: 60_000 },
  "/api/news/comments": { max: 30, windowMs: 60_000 },
};

const MAX_STORE_SIZE = 10_000;

function createInMemoryStore() {
  const store = new Map<string, { count: number; resetAt: number }>();
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
    if (store.size > MAX_STORE_SIZE) {
      const sorted = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      const toDelete = sorted.slice(0, sorted.length - MAX_STORE_SIZE);
      for (const [key] of toDelete) store.delete(key);
    }
  }

  return { store, cleanup };
}

function createUpstashRatelimiter() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.warn("middleware.upstash_unavailable", { hasUrl: !!url, hasToken: !!token });
    return null;
  }

  const redis = new Redis({ url, token });
  const chat = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS["/api/studio/chat"].max, `${RATE_LIMITS["/api/studio/chat"].windowMs}ms`),
    prefix: "ratelimit:chat",
  });
  const agents = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS["/api/studio/agents"].max, `${RATE_LIMITS["/api/studio/agents"].windowMs}ms`),
    prefix: "ratelimit:agents",
  });
  const status = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS["/api/studio/status"].max, `${RATE_LIMITS["/api/studio/status"].windowMs}ms`),
    prefix: "ratelimit:status",
  });
  const feedback = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS["/api/studio/feedback"].max, `${RATE_LIMITS["/api/studio/feedback"].windowMs}ms`),
    prefix: "ratelimit:feedback",
  });

  return { chat, agents, status, feedback };
}

const upstash = createUpstashRatelimiter();
const memStore = upstash ? null : createInMemoryStore();

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

async function checkRateLimit(pathname: string, ip: string): Promise<NextResponse | null> {
  const limits = RATE_LIMITS[pathname];
  if (!limits) return null;

  if (upstash) {
    const limiter = upstash[pathname === "/api/studio/chat" ? "chat" : pathname === "/api/studio/agents" ? "agents" : pathname === "/api/studio/status" ? "status" : "feedback"];
    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      console.warn("middleware.rate_limited", { pathname, ip, retryAfter });
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down.", code: "RATE_LIMITED", retryAfter }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "RateLimit-Limit": String(limit),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": String(retryAfter),
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set("RateLimit-Limit", String(limit));
    response.headers.set("RateLimit-Remaining", String(remaining));
    response.headers.set("RateLimit-Reset", String(Math.ceil((reset - Date.now()) / 1000)));
    return response;
  }

  memStore!.cleanup();

  const key = `${pathname}:${ip}`;
  const now = Date.now();
  const entry = memStore!.store.get(key);

  if (!entry || now > entry.resetAt) {
    memStore!.store.set(key, { count: 1, resetAt: now + limits.windowMs });
    return null;
  }

  if (entry.count >= limits.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    console.warn("middleware.rate_limited", { pathname, ip, retryAfter });
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/studio/chat")) {
    try {
      validateOrigin(request);
    } catch {
      return new NextResponse(
        JSON.stringify({ error: "Cross-origin request rejected", code: "FORBIDDEN" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const ip = getClientIp(request);
  const rateLimitResponse = await checkRateLimit(pathname, ip);
  if (rateLimitResponse) return rateLimitResponse;

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/studio/:path*"],
};
