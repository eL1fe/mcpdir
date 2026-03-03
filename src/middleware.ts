import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const ROUTE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/claims": { max: 10, windowMs: 60_000 },
  "/api/reviews": { max: 20, windowMs: 60_000 },
  "/api/submissions": { max: 10, windowMs: 60_000 },
  "/api/reports": { max: 10, windowMs: 60_000 },
};

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

function cleanupIfNeeded() {
  if (rateLimitMap.size > 10_000) {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (entry.resetAt <= now) rateLimitMap.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  const { method, nextUrl } = request;

  if (method !== "POST" && method !== "PUT" && method !== "DELETE") {
    return NextResponse.next();
  }

  if (!nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // find matching route limit
  const matchedRoute = Object.keys(ROUTE_LIMITS).find((route) =>
    nextUrl.pathname.startsWith(route)
  );
  if (!matchedRoute) return NextResponse.next();

  const { max, windowMs } = ROUTE_LIMITS[matchedRoute];
  const ip = getClientIp(request);
  const key = `${ip}:${matchedRoute}`;
  const now = Date.now();

  cleanupIfNeeded();

  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(max));
    response.headers.set("X-RateLimit-Remaining", String(max - 1));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
    return response;
  }

  entry.count++;

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(max));
  response.headers.set("X-RateLimit-Remaining", String(max - entry.count));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
