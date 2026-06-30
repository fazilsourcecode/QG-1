import { NextResponse } from "next/server";
import { scanFileFromDataURL } from "@/lib/file-scanner";

export const dynamic = "force-dynamic";

async function logToRedis(entry: any) {
  try {
    const { getRedis } = await import("@/lib/redis");
    const redis = getRedis();
    await redis.lpush("qg:security:logs", JSON.stringify(entry));
    await redis.ltrim("qg:security:logs", 0, 499);
  } catch {
    // Redis unavailable — fail silently
  }
}

export async function POST(request: Request) {
  try {
    const { filename, mimeType, dataURL } = await request.json();

    if (!filename || !mimeType || !dataURL) {
      return NextResponse.json(
        { error: "Missing filename, mimeType, or dataURL" },
        { status: 400 }
      );
    }

    const result = scanFileFromDataURL(filename, mimeType, dataURL);

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    await logToRedis({
      timestamp: new Date().toISOString(),
      type: result.safe ? "FILE_SCAN" : "MALICIOUS_UPLOAD",
      ip,
      path: "/upload",
      threat: result.threat,
      details: result.details,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        safe: false,
        threat: "SCAN_ERROR",
        details: error instanceof Error ? error.message : "Scan failed",
        filename: "unknown",
        declaredType: "unknown",
        actualType: "unknown",
      },
      { status: 200 }
    );
  }
}
