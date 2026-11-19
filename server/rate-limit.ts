export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * In-memory token bucket. Single-process demo: limits reset on restart and
 * are intentionally process-local.
 */
export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {}

  take(key: string, now: number = Date.now()): RateLimitDecision {
    const refillPerMs = this.capacity / this.windowMs;
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    const elapsed = Math.max(0, now - bucket.updatedAt);

    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * refillPerMs);
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);

    this.sweep(now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs)),
    };
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > 10 * 60_000) {
        this.buckets.delete(key);
      }
    }
  }
}
