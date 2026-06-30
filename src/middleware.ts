import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectSQLInjection, detectXSS, detectPathTraversal, detectCommandInjection } from "@/lib/security";

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export function middleware(request: NextRequest) {
  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/security/")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.toString();

  const checks = [
    { check: detectSQLInjection(url), threat: "SQL_INJECTION" },
    { check: detectXSS(url), threat: "XSS" },
    { check: detectPathTraversal(url), threat: "PATH_TRAVERSAL" },
    { check: detectCommandInjection(url), threat: "COMMAND_INJECTION" },
  ];

  for (const { check, threat } of checks) {
    if (!check.safe) {
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

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
