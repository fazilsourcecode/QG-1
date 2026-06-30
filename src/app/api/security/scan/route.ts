import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { filename, threat, details } = await request.json();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return NextResponse.json({ ok: true });
    }

    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });

    await redis.lpush("qg:security:logs", JSON.stringify({
      timestamp: new Date().toISOString(),
      type: threat === "CLEAN" ? "FILE_SCAN" : "MALICIOUS_UPLOAD",
      ip,
      path: "/upload",
      threat: threat || "CLEAN",
      details: details || `File ${filename} scanned`,
    }));

    await redis.ltrim("qg:security:logs", 0, 499);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
