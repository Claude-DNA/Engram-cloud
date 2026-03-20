// RateLimiter.ts — per-platform rate limit management

export interface PlatformLimits {
  maxRequests: number;
  windowMs: number;
  platform: string;
}

const DEFAULT_LIMITS: Record<string, PlatformLimits> = {
  twitter: { maxRequests: 900, windowMs: 15 * 60 * 1000, platform: 'twitter' },
  instagram: { maxRequests: 200, windowMs: 60 * 60 * 1000, platform: 'instagram' },
  youtube: { maxRequests: 10000, windowMs: 24 * 60 * 60 * 1000, platform: 'youtube' },
};

export class RateLimiter {
  private remaining: number;
  private resetAt: number;
  private limits: PlatformLimits;

  constructor(platform: string) {
    this.limits = DEFAULT_LIMITS[platform] ?? { maxRequests: 100, windowMs: 15 * 60 * 1000, platform };
    this.remaining = this.limits.maxRequests;
    this.resetAt = Date.now() + this.limits.windowMs;
  }

  get isLimited(): boolean {
    return this.remaining <= 0 && Date.now() < this.resetAt;
  }

  get waitTimeMs(): number {
    if (!this.isLimited) return 0;
    return Math.max(0, this.resetAt - Date.now());
  }

  get remainingRequests(): number {
    if (Date.now() >= this.resetAt) {
      this.remaining = this.limits.maxRequests;
      this.resetAt = Date.now() + this.limits.windowMs;
    }
    return this.remaining;
  }

  get resetAtDate(): Date {
    return new Date(this.resetAt);
  }

  async waitIfNeeded(): Promise<void> {
    if (Date.now() >= this.resetAt) {
      this.remaining = this.limits.maxRequests;
      this.resetAt = Date.now() + this.limits.windowMs;
      return;
    }
    if (this.remaining <= 0) {
      const waitMs = this.resetAt - Date.now();
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        this.remaining = this.limits.maxRequests;
        this.resetAt = Date.now() + this.limits.windowMs;
      }
    }
  }

  update(headers: { remaining?: number; resetAt?: number }): void {
    if (headers.remaining !== undefined) this.remaining = headers.remaining;
    if (headers.resetAt !== undefined) this.resetAt = headers.resetAt;
  }

  consume(count: number = 1): void {
    this.remaining = Math.max(0, this.remaining - count);
  }
}
