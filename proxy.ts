import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GH_PAGES_ORIGIN = "https://fworks-tech.github.io";
const GH_PAGES_BASE = "/agenthood";

const PROXY_PATHS = ["/academy", "/adr", "/assets"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const proxyPath = PROXY_PATHS.find((p) => pathname.startsWith(p));
  if (!proxyPath) {
    return NextResponse.next();
  }

  const url = new URL(
    `${GH_PAGES_BASE}${pathname}${request.nextUrl.search}`,
    GH_PAGES_ORIGIN,
  );

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/academy/:path*", "/adr/:path*", "/assets/:path*"],
};
