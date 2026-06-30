import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { filename, mimeType, dataURL } = await request.json();

    if (!filename || !mimeType || !dataURL) {
      return NextResponse.json(
        { error: "Missing filename, mimeType, or dataURL" },
        { status: 400 }
      );
    }

    const base64 = dataURL.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const MALICIOUS_SIGNATURES: Record<string, number[][]> = {
      "PE/EXE": [[0x4d, 0x5a]],
      "ELF": [[0x7f, 0x45, 0x4c, 0x46]],
      "PDF": [[0x25, 0x50, 0x44, 0x46]],
      "MSI": [[0xd0, 0xcf, 0x11, 0xe0]],
      "ZIP/DOCX": [[0x50, 0x4b, 0x03, 0x04]],
    };

    const IMAGE_SIGNATURES: Record<string, number[][]> = {
      "image/jpeg": [[0xff, 0xd8, 0xff]],
      "image/png": [[0x89, 0x50, 0x4e, 0x47]],
      "image/gif": [[0x47, 0x49, 0x46, 0x38]],
      "image/bmp": [[0x42, 0x4d]],
      "image/webp": [[0x52, 0x49, 0x46, 0x46]],
    };

    let detectedType = "unknown";
    let isMalicious = false;
    let threatType = "";

    for (const [name, sigs] of Object.entries(MALICIOUS_SIGNATURES)) {
      for (const sig of sigs) {
        if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) {
          detectedType = name;
          isMalicious = true;
          threatType = name;
          break;
        }
      }
      if (isMalicious) break;
    }

    if (!isMalicious) {
      for (const [mime, sigs] of Object.entries(IMAGE_SIGNATURES)) {
        for (const sig of sigs) {
          if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) {
            detectedType = mime;
            break;
          }
        }
        if (detectedType !== "unknown") break;
      }
    }

    const ext = filename.lastIndexOf(".") !== -1 ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
    const extToMime: Record<string, string> = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp",
      ".exe": "application/x-dosexec", ".msi": "application/x-msi",
      ".pdf": "application/pdf",
    };
    const expectedMime = extToMime[ext] || null;

    let safe = true;
    let threat = "CLEAN";
    let details = `File ${filename} passed all security checks`;

    if (isMalicious) {
      safe = false;
      threat = threatType;
      details = `Malicious file detected: actual type is ${detectedType}, declared as ${mimeType}`;
    } else if (expectedMime && detectedType !== "unknown" && expectedMime !== detectedType) {
      safe = false;
      threat = "FILE_MASQUERADE";
      details = `File extension ${ext} claims ${expectedMime} but actual type is ${detectedType}`;
    } else if (!isMalicious && detectedType === "unknown" && bytes.length > 0) {
      safe = false;
      threat = "UNKNOWN_TYPE";
      details = `Cannot identify file type for ${filename}. Possible obfuscation.`;
    }

    let ip = "unknown";
    try {
      ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    } catch {}

    try {
      const { getRedis } = await import("@upstash/redis");
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        const redis = getRedis();
        await redis.lpush("qg:security:logs", JSON.stringify({
          timestamp: new Date().toISOString(),
          type: safe ? "FILE_SCAN" : "MALICIOUS_UPLOAD",
          ip,
          path: "/upload",
          threat,
          details,
        }));
        await redis.ltrim("qg:security:logs", 0, 499);
      }
    } catch {}

    return NextResponse.json({ safe, threat, details, filename, declaredType: mimeType, actualType: detectedType });
  } catch (error) {
    return NextResponse.json(
      { safe: false, threat: "SCAN_ERROR", details: error instanceof Error ? error.message : "Scan failed", filename: "unknown", declaredType: "unknown", actualType: "unknown" },
      { status: 200 }
    );
  }
}
