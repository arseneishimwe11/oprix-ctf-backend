import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  ttl: number; // Time window in seconds
  limit: number; // Max requests in window
}

/**
 * Custom rate limit decorator for specific endpoints
 * Usage: @RateLimit({ ttl: 60, limit: 5 })
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);