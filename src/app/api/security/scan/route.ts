import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { filename, threat, details } = await request.json();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return NextResponse.json({ ok: false, error: "no env vars" });
    }

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: threat === "CLEAN" ? "FILE_SCAN" : "MALICIOUS_UPLOAD",
      ip,
      path: "/upload",
      threat: threat || "CLEAN",
      details: details || `File ${filename} scanned`,
    });

    const redisRes = await fetch(`${url}/lpush/qg%3Asecurity%3Alogs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([entry]),
    });

    return NextResponse.json({ ok: redisRes.ok, status: redisRes.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown" });
  }
}
