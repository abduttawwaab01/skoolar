import { Redis } from '@upstash/redis';

// Initialize Upstash Redis if environment variables are set
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
  }

  return redis;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (e.g., "login:192.168.1.1")
 * Uses sliding window algorithm with Redis for distributed rate limiting.
 * Falls back to in-memory if Redis not configured (with warning).
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 1000 // 1 minute
): Promise<RateLimitResult> {
  const redisClient = getRedis();

  if (redisClient) {
    // Use Redis for distributed rate limiting
    const current = await redisClient.incr(key);
    
    if (current === 1) {
      // First request, set expiry
      await redisClient.expire(key, Math.ceil(windowMs / 1000));
    }

    if (current > maxAttempts) {
      const ttl = await redisClient.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + ttl * 1000,
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - current,
      resetAt: Date.now() + windowMs, // approximate
    };
  }

  // Fallback to in-memory rate limiting (single instance only)
  // This is NOT suitable for production with multiple instances
  if (process.env.NODE_ENV === 'production') {
    console.warn('[RateLimiter] Upstash Redis not configured. Rate limiting will not work across instances. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }

  // Simple in-memory implementation (same as before)
  // In production without Redis, this provides only per-instance limiting
  const memoryKey = `ratelimit:${key}`;
  const entry = (global as any).__rate_limit_store?.[memoryKey];

  const now = Date.now();

  if (!entry || now > entry.resetAt) {
    if (!(global as any).__rate_limit_store) {
      (global as any).__rate_limit_store = {};
    }
    (global as any).__rate_limit_store[memoryKey] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count, resetAt: entry.resetAt };
}

/**
 * Reset rate limit for a key (useful for testing or manual override)
 */
export async function resetRateLimit(key: string): Promise<boolean> {
  const redisClient = getRedis();
  if (redisClient) {
    await redisClient.del(key);
    return true;
  }
  if ((global as any).__rate_limit_store?.[key]) {
    delete (global as any).__rate_limit_store[key];
    return true;
  }
  return false;
}
