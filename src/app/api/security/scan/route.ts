import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { filename, threat, details } = await request.json();

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    try {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        const entry = {
          timestamp: new Date().toISOString(),
          type: threat === "CLEAN" ? "FILE_SCAN" : "MALICIOUS_UPLOAD",
          ip,
          path: "/upload",
          threat: threat || "CLEAN",
          details: details || `File ${filename} scanned`,
        };

        const redisRes = await fetch(`${url}/lpush/qg:security:logs`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([JSON.stringify(entry)]),
        });

        if (!redisRes.ok) {
          console.error("Redis write failed:", redisRes.status, await redisRes.text());
        }
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
