import { redis } from "./redis";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 3600000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000,
};

export function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): { allowed: boolean; remaining: number; retryAfter: number } {
  cleanup();

  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!store.has(identifier)) {
    store.set(identifier, { timestamps: [] });
  }

  const entry = store.get(identifier)!;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfter: 0,
  };
}

export function getRateLimitStats(): Record<string, number> {
  cleanup();
  const stats: Record<string, number> = {};
  for (const [key, entry] of store.entries()) {
    stats[key] = entry.timestamps.length;
  }
  return stats;
}

const REDIS_LOG_KEY = "qg:security:logs";
const MAX_LOGS = 500;

export async function logSecurityEvent(
  type: string,
  ip: string,
  path: string,
  threat: string,
  details: string
): Promise<void> {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      ip,
      path,
      threat,
      details,
    };

    await redis.lpush(REDIS_LOG_KEY, JSON.stringify(entry));
    await redis.ltrim(REDIS_LOG_KEY, 0, MAX_LOGS - 1);
  } catch {
    // Redis unavailable — fail silently
  }
}

export async function getSecurityLogs(
  limit: number = 100
): Promise<Array<{
  timestamp: string;
  type: string;
  ip: string;
  path: string;
  threat: string;
  details: string;
}>> {
  try {
    const raw = await redis.lrange(REDIS_LOG_KEY, 0, limit - 1);
    return raw.map((item) => JSON.parse(item));
  } catch {
    return [];
  }
}
