export interface SecurityResult {
  safe: boolean;
  threatType: string | null;
  details: string | null;
}

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b\s+)/i,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
  /(;\s*(DROP|DELETE|INSERT|UPDATE|SELECT)\b)/i,
  /(UNION\s+(ALL\s+)?SELECT)/i,
  /(';\s*(DROP|DELETE|INSERT|UPDATE)\b)/i,
  /(--\s*$)/,
  /(\/\*[\s\S]*?\*\/)/,
  /(\bEXEC(\b|UTE)?\s*\()/i,
  /(\bWAITFOR\b\s+DELAY\b)/i,
  /(CHAR\s*\(\s*\d+)/i,
  /(%27)|(%22)|(%3B)|(%2D%2D)/i,
];

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /on(error|load|click|mouse|key|focus|blur|submit|change|input)\s*=/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<applet[\s>]/i,
  /data\s*:\s*text\/html/i,
  /<svg[\s>].*?on\w+\s*=/i,
  /expression\s*\(/i,
  /<img[\s>]+[^>]*?(onerror|onload)\s*=/i,
  /eval\s*\(/i,
  /document\.(cookie|write|location)/i,
  /window\.(location|open)/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /\/\.\.\//,
  /\\\.\.\\/,
  /\.\.%2f/i,
  /\.\.%5c/i,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\/proc\/self/i,
  /c:\\windows/i,
  /c:\\winnt/i,
];

const COMMAND_INJECTION_PATTERNS = [
  /[;|`]\s*(ls|cat|pwd|whoami|id|uname|sh|bash|cmd|powershell)/i,
  /\$\([^)]+\)/,
  /\$\{[^}]+\}/,
  /[;|]\s*(rm|mv|cp|chmod|chown)\s+/i,
  /[;|]\s*(wget|curl)\s+/i,
  /[;|]\s*(nc|netcat)\s+/i,
  /[;|]\s*(python|perl|ruby|node)\s+/i,
  /`[^`]+`/,
];

function matchesPatterns(input: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(input));
}

export function detectSQLInjection(input: string): SecurityResult {
  if (matchesPatterns(input, SQL_INJECTION_PATTERNS)) {
    return {
      safe: false,
      threatType: "SQL_INJECTION",
      details: "SQL injection pattern detected in input",
    };
  }
  return { safe: true, threatType: null, details: null };
}

export function detectXSS(input: string): SecurityResult {
  if (matchesPatterns(input, XSS_PATTERNS)) {
    return {
      safe: false,
      threatType: "XSS",
      details: "Cross-site scripting pattern detected in input",
    };
  }
  return { safe: true, threatType: null, details: null };
}

export function detectPathTraversal(input: string): SecurityResult {
  if (matchesPatterns(input, PATH_TRAVERSAL_PATTERNS)) {
    return {
      safe: false,
      threatType: "PATH_TRAVERSAL",
      details: "Path traversal pattern detected in input",
    };
  }
  return { safe: true, threatType: null, details: null };
}

export function detectCommandInjection(input: string): SecurityResult {
  if (matchesPatterns(input, COMMAND_INJECTION_PATTERNS)) {
    return {
      safe: false,
      threatType: "COMMAND_INJECTION",
      details: "Command injection pattern detected in input",
    };
  }
  return { safe: true, threatType: null, details: null };
}

export function validateFileName(filename: string): SecurityResult {
  const checks = [
    detectSQLInjection(filename),
    detectXSS(filename),
    detectPathTraversal(filename),
    detectCommandInjection(filename),
  ];

  for (const result of checks) {
    if (!result.safe) {
      return result;
    }
  }

  return { safe: true, threatType: null, details: null };
}

export function validateInput(input: string): SecurityResult {
  return validateFileName(input);
}

export function getAllSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
  };
}
