import { NextResponse } from "next/server";
import { scanFileFromDataURL } from "@/lib/file-scanner";
import { logSecurityEvent } from "@/lib/rate-limiter";

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

    await logSecurityEvent(
      result.safe ? "FILE_SCAN" : "MALICIOUS_UPLOAD",
      ip,
      "/upload",
      result.threat,
      result.details
    );

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
