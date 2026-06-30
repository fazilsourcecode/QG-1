export interface ScanResult {
  safe: boolean;
  threat: string;
  details: string;
  filename: string;
  declaredType: string;
  actualType: string;
}

const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/bmp": [[0x42, 0x4d]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "application/zip": [[0x50, 0x4b, 0x03, 0x04]],
  "application/x-executable": [[0x7f, 0x45, 0x4c, 0x46]],
  "application/x-dosexec": [[0x4d, 0x5a]],
  "application/x-msi": [[0xd0, 0xcf, 0x11, 0xe0]],
  "application/x-shockwave-flash": [[0x46, 0x57, 0x53]],
};

const MALICIOUS_TYPES = new Set([
  "application/x-executable",
  "application/x-dosexec",
  "application/x-msi",
  "application/x-shockwave-flash",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".exe": "application/x-dosexec",
  ".msi": "application/x-msi",
  ".sh": "application/x-shockwave-flash",
};

function detectFileType(bytes: Uint8Array): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (bytes.length >= sig.length && sig.every((byte, i) => bytes[i] === byte)) {
        return mime;
      }
    }
  }
  return null;
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

export function scanFile(
  filename: string,
  declaredMimeType: string,
  fileBytes: Uint8Array
): ScanResult {
  const ext = getExtension(filename);
  const declaredExtMime = EXTENSION_TO_MIME[ext] || null;
  const actualType = detectFileType(fileBytes);

  if (actualType && MALICIOUS_TYPES.has(actualType)) {
    return {
      safe: false,
      threat: actualType,
      details: `Malicious file detected: actual type is ${actualType}, disguised as ${declaredMimeType}`,
      filename,
      declaredType: declaredMimeType,
      actualType,
    };
  }

  if (declaredExtMime && actualType && declaredExtMime !== actualType) {
    return {
      safe: false,
      threat: "FILE masquerade",
      details: `File extension ${ext} claims ${declaredExtMime} but actual type is ${actualType}`,
      filename,
      declaredType: declaredMimeType,
      actualType,
    };
  }

  if (!actualType && fileBytes.length > 0) {
    return {
      safe: false,
      threat: "UNKNOWN type",
      details: `Cannot identify file type for ${filename}. Possible obfuscation.`,
      filename,
      declaredType: declaredMimeType,
      actualType: "unknown",
    };
  }

  return {
    safe: true,
    threat: "CLEAN",
    details: `File ${filename} passed all security checks`,
    filename,
    declaredType: declaredMimeType,
    actualType: actualType || declaredMimeType,
  };
}

export function scanFileFromDataURL(
  filename: string,
  declaredMimeType: string,
  dataURL: string
): ScanResult {
  const base64 = dataURL.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return scanFile(filename, declaredMimeType, bytes);
}
