"use client";

export interface ScanResult {
  safe: boolean;
  threat: string;
  details: string;
}

const MALICIOUS_SIGNATURES: Record<string, number[][]> = {
  "PE/EXE": [[0x4d, 0x5a]],
  "ELF": [[0x7f, 0x45, 0x4c, 0x46]],
  "MSI": [[0xd0, 0xcf, 0x11, 0xe0]],
};

const IMAGE_SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/bmp": [[0x42, 0x4d]],
};

function detectType(bytes: Uint8Array): string | null {
  for (const [name, sigs] of Object.entries(MALICIOUS_SIGNATURES)) {
    for (const sig of sigs) {
      if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) {
        return name;
      }
    }
  }
  for (const [mime, sigs] of Object.entries(IMAGE_SIGNATURES)) {
    for (const sig of sigs) {
      if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) {
        return mime;
      }
    }
  }
  return null;
}

async function logScan(filename: string, threat: string, details: string) {
  try {
    await fetch("/api/security/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, threat, details }),
    });
  } catch {}
}

export async function scanFile(file: File): Promise<ScanResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectType(bytes);
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  const MALICIOUS_EXTS = new Set([".exe", ".msi", ".bat", ".cmd", ".sh", ".ps1", ".scr", ".com", ".pif"]);

  if (MALICIOUS_EXTS.has(ext)) {
    const result = {
      safe: false,
      threat: "MALICIOUS_EXTENSION",
      details: `Blocked: ${file.name} has dangerous extension ${ext}`,
    };
    await logScan(file.name, result.threat, result.details);
    return result;
  }

  for (const [name] of Object.entries(MALICIOUS_SIGNATURES)) {
    if (detectedType === name) {
      const result = {
        safe: false,
        threat: name,
        details: `Malicious file detected: ${file.name} is actually ${name}`,
      };
      await logScan(file.name, result.threat, result.details);
      return result;
    }
  }

  const EXT_TO_MIME: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp",
  };

  const expectedMime = EXT_TO_MIME[ext];
  if (expectedMime && detectedType && expectedMime !== detectedType) {
    const result = {
      safe: false,
      threat: "FILE_MASQUERADE",
      details: `File ${file.name} extension says ${expectedMime} but actual type is ${detectedType}`,
    };
    await logScan(file.name, result.threat, result.details);
    return result;
  }

  if (!detectedType && bytes.length > 0) {
    const result = {
      safe: false,
      threat: "UNKNOWN_TYPE",
      details: `Cannot identify ${file.name}. Possible obfuscation.`,
    };
    await logScan(file.name, result.threat, result.details);
    return result;
  }

  const result = {
    safe: true,
    threat: "CLEAN",
    details: `File ${file.name} passed all security checks`,
  };
  await logScan(file.name, result.threat, result.details);
  return result;
}
