import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

/**
 * Production-Grade Rate Limiting Service
 * Implements Redis-based distributed rate limiting with multiple strategies
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: RedisClientType;

  constructor(private configService: ConfigService) {
    const redisHost = this.configService.get<string>('redis.host', 'localhost');
    const redisPort = this.configService.get<number>('redis.port', 6379);
    const redisPassword = this.configService.get<string>('redis.password');
    
    this.logger.log(`Connecting to Redis at ${redisHost}:${redisPort}`);
    
    this.redis = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
      password: redisPassword,
      database: this.configService.get<number>('redis.db', 0),
    });
    
    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
    
    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
    
    this.redis.connect();
  }

  /**
   * Check submission rate limit (5 submissions per minute)
   * @param userId - User ID
   * @throws BadRequestException if rate limit exceeded
   */
  async checkSubmissionRateLimit(userId: string): Promise<void> {
    const key = `rate_limit:submissions:${userId}`;
    const window = 60; // 1 minute in seconds
    const limit = 5; // 5 submissions per minute

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      // First request in this window, set expiration
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      const ttl = await this.redis.ttl(key);
      this.logger.warn(`Rate limit exceeded for user ${userId}. Current: ${current}, TTL: ${ttl}s`);
      throw new BadRequestException(
        `Rate limit exceeded. You can make ${limit} submissions per minute. Please wait ${ttl} seconds.`
      );
    }

    this.logger.debug(`Rate limit check passed for user ${userId}: ${current}/${limit}`);
  }

  /**
   * Check and enforce submission timeout after 3 consecutive failures
   * @param userId - User ID
   * @param challengeId - Challenge ID
   * @throws BadRequestException if user is in timeout
   */
  async checkSubmissionTimeout(userId: string, challengeId: string): Promise<void> {
    const key = `submission_timeout:${userId}:${challengeId}`;
    const timeoutDuration = 5 * 60; // 5 minutes in seconds

    const timeoutEnd = await this.redis.get(key);
    
    if (timeoutEnd) {
      const remainingSeconds = parseInt(timeoutEnd) - Math.floor(Date.now() / 1000);
      
      if (remainingSeconds > 0) {
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        this.logger.warn(`User ${userId} in submission timeout for challenge ${challengeId}. Remaining: ${remainingMinutes}min`);
        throw new BadRequestException(
          `Submission timeout active. Please wait ${remainingMinutes} minutes after 3 consecutive wrong submissions.`
        );
      } else {
        // Timeout expired, remove the key
        await this.redis.del(key);
      }
    }
  }

  /**
   * Track consecutive wrong submissions and set timeout if needed
   * @param userId - User ID
   * @param challengeId - Challenge ID
   * @param isCorrect - Whether the submission was correct
   */
  async trackSubmissionAttempt(userId: string, challengeId: string, isCorrect: boolean): Promise<void> {
    const consecutiveKey = `consecutive_fails:${userId}:${challengeId}`;
    const timeoutKey = `submission_timeout:${userId}:${challengeId}`;

    if (isCorrect) {
      // Reset consecutive failures on correct submission
      await this.redis.del(consecutiveKey);
      await this.redis.del(timeoutKey);
      this.logger.debug(`Reset consecutive failures for user ${userId} on challenge ${challengeId}`);
    } else {
      // Increment consecutive failures
      const consecutive = await this.redis.incr(consecutiveKey);
      await this.redis.expire(consecutiveKey, 3600); // Expire after 1 hour if no activity

      if (consecutive >= 3) {
        // Set timeout for 5 minutes
        const timeoutEnd = Math.floor(Date.now() / 1000) + (5 * 60);
        await this.redis.setEx(timeoutKey, 5 * 60, timeoutEnd.toString());
        
        this.logger.warn(`User ${userId} entered submission timeout for challenge ${challengeId} after ${consecutive} consecutive failures`);
      } else {
        this.logger.debug(`User ${userId} has ${consecutive} consecutive failures for challenge ${challengeId}`);
      }
    }
  }

  /**
   * Generic rate limiting for any endpoint
   * @param key - Unique key for the rate limit
   * @param limit - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   * @throws BadRequestException if rate limit exceeded
   */
  async checkGenericRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      const ttl = await this.redis.ttl(key);
      throw new BadRequestException(
        `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds} seconds. Please wait ${ttl} seconds.`
      );
    }
  }

  /**
   * Check if user has already solved a challenge
   * @param userId - User ID
   * @param challengeId - Challenge ID
   * @returns boolean indicating if already solved
   */
  async isChallengeSolved(userId: string, challengeId: string): Promise<boolean> {
    const key = `solved:${userId}:${challengeId}`;
    const solved = await this.redis.get(key);
    return solved === '1';
  }

  /**
   * Mark challenge as solved by user
   * @param userId - User ID
   * @param challengeId - Challenge ID
   */
  async markChallengeSolved(userId: string, challengeId: string): Promise<void> {
    const key = `solved:${userId}:${challengeId}`;
    await this.redis.set(key, '1');
    // No expiration - solved challenges remain solved
  }

  /**
   * Clean up expired rate limit keys (maintenance task)
   */
  async cleanupExpiredKeys(): Promise<void> {
    try {
      // This would be called by a scheduled job
      const pattern = 'rate_limit:*';
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        // Check TTL for each key and collect expired ones
        const expiredKeys: string[] = [];
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) {
            expiredKeys.push(key);
          }
        }
        
        if (expiredKeys.length > 0) {
          await this.redis.del(expiredKeys);
          this.logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit keys`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired keys', error);
    }
  }

  /**
   * Get remaining time for a rate limit key
   * @param key - Rate limit key
   * @returns remaining seconds, or 0 if no limit active
   */
  async getRemainingTime(key: string): Promise<number> {
    const ttl = await this.redis.ttl(key);
    return Math.max(0, ttl);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
