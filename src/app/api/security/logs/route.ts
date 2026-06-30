import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const emptyStats = {
    total_events: 0, sql_injection: 0, xss: 0, path_traversal: 0,
    command_injection: 0, rate_limits: 0, malicious_uploads: 0, clean_files: 0,
  };

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return NextResponse.json({ logs: [], stats: emptyStats });
    }

    const limit = parseInt(new URL(request.url).searchParams.get("limit") || "100");

    const res = await fetch(
      `${url}/lrange/qg%3Asecurity%3Alogs/0/${limit - 1}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ logs: [], stats: emptyStats });
    }

    const body = await res.json();
    const raw: string[] = body.result || body;

    if (!Array.isArray(raw)) {
      return NextResponse.json({ logs: [], stats: emptyStats });
    }

    const logs = raw.map((item) => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);

    const stats = {
      total_events: logs.length,
      sql_injection: logs.filter((l: any) => l.threat === "SQL_INJECTION").length,
      xss: logs.filter((l: any) => l.threat === "XSS").length,
      path_traversal: logs.filter((l: any) => l.threat === "PATH_TRAVERSAL").length,
      command_injection: logs.filter((l: any) => l.threat === "COMMAND_INJECTION").length,
      rate_limits: logs.filter((l: any) => l.threat === "RATE_LIMIT").length,
      malicious_uploads: logs.filter((l: any) => l.threat === "MALICIOUS_UPLOAD").length,
      clean_files: logs.filter((l: any) => l.threat === "CLEAN" || l.threat === "FILE_SCAN").length,
    };

    return NextResponse.json({ logs, stats });
  } catch {
    return NextResponse.json({ logs: [], stats: emptyStats });
  }
}
