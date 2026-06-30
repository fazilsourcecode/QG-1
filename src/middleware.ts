import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectSQLInjection, detectXSS, detectPathTraversal, detectCommandInjection, getAllSecurityHeaders } from "@/lib/security";

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

const inMemoryLogs: Array<{
  timestamp: string;
  type: string;
  ip: string;
  path: string;
  threat: string;
  details: string;
}> = [];

export function getMiddlewareLogs() {
  return inMemoryLogs.slice(-100);
}

export function middleware(request: NextRequest) {
  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;

  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 100;

  const url = request.nextUrl.toString();

  const checks = [
    { check: detectSQLInjection(url), threat: "SQL_INJECTION" },
    { check: detectXSS(url), threat: "XSS" },
    { check: detectPathTraversal(url), threat: "PATH_TRAVERSAL" },
    { check: detectCommandInjection(url), threat: "COMMAND_INJECTION" },
  ];

  for (const { check, threat } of checks) {
    if (!check.safe) {
      inMemoryLogs.push({
        timestamp: new Date().toISOString(),
        type: threat,
        ip,
        path,
        threat,
        details: check.details || `${threat} detected`,
      });
      if (inMemoryLogs.length > 500) inMemoryLogs.splice(0, inMemoryLogs.length - 500);

      return NextResponse.json(
        { error: "Request blocked", threat, details: check.details },
        { status: 403 }
      );
    }
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
            inMemoryLogs.push({
              timestamp: new Date().toISOString(),
              type: "MALICIOUS_UPLOAD",
              ip,
              path,
              threat: check.threatType || "UNKNOWN",
              details: `Malicious filename: ${filename}`,
            });
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
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
