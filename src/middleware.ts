import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectSQLInjection, detectXSS, detectPathTraversal, detectCommandInjection, getAllSecurityHeaders } from "@/lib/security";
import { checkRateLimit, logSecurityEvent } from "@/lib/rate-limiter";

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function logAttack(
  type: string,
  ip: string,
  path: string,
  threat: string,
  details: string
): void {
  logSecurityEvent(type, ip, path, threat, details);
}

export function middleware(request: NextRequest) {
  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;

  const rateLimitResult = checkRateLimit(ip, {
    maxRequests: 100,
    windowMs: 60000,
  });

  if (!rateLimitResult.allowed) {
    logAttack("RATE_LIMIT", ip, path, "RATE_LIMIT", `Rate limit exceeded: retry after ${rateLimitResult.retryAfter}s`);
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests. Try again in ${rateLimitResult.retryAfter} seconds.`,
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429 }
    );
  }

  const url = request.nextUrl.toString();
  const sqlCheck = detectSQLInjection(url);
  if (!sqlCheck.safe) {
    logAttack("SQL_INJECTION", ip, path, "SQL_INJECTION", sqlCheck.details || "SQL injection detected");
    return NextResponse.json(
      { error: "Request blocked", threat: "SQL_INJECTION", details: sqlCheck.details },
      { status: 403 }
    );
  }

  const xssCheck = detectXSS(url);
  if (!xssCheck.safe) {
    logAttack("XSS", ip, path, "XSS", xssCheck.details || "XSS detected");
    return NextResponse.json(
      { error: "Request blocked", threat: "XSS", details: xssCheck.details },
      { status: 403 }
    );
  }

  const traversalCheck = detectPathTraversal(url);
  if (!traversalCheck.safe) {
    logAttack("PATH_TRAVERSAL", ip, path, "PATH_TRAVERSAL", traversalCheck.details || "Path traversal detected");
    return NextResponse.json(
      { error: "Request blocked", threat: "PATH_TRAVERSAL", details: traversalCheck.details },
      { status: 403 }
    );
  }

  const cmdCheck = detectCommandInjection(url);
  if (!cmdCheck.safe) {
    logAttack("COMMAND_INJECTION", ip, path, "COMMAND_INJECTION", cmdCheck.details || "Command injection detected");
    return NextResponse.json(
      { error: "Request blocked", threat: "COMMAND_INJECTION", details: cmdCheck.details },
      { status: 403 }
    );
  }

  if (request.method === "POST" && path.includes("/api/")) {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const filename = request.headers.get("x-filename") || "";
      if (filename) {
        const filenameChecks = [
          detectSQLInjection(filename),
          detectXSS(filename),
          detectPathTraversal(filename),
          detectCommandInjection(filename),
        ];

        for (const check of filenameChecks) {
          if (!check.safe) {
            logAttack("MALICIOUS_UPLOAD", ip, path, check.threatType || "UNKNOWN", `Malicious filename: ${filename}`);
            return NextResponse.json(
              { error: "Malicious filename detected", threat: check.threatType, details: check.details },
              { status: 403 }
            );
          }
        }
      }
    }
  }

  const response = NextResponse.next();

  const headers = getAllSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
