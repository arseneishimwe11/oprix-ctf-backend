import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Cache TTL settings (in seconds)
  ttl: {
    leaderboard: parseInt(process.env.REDIS_LEADERBOARD_TTL || '60', 10), // 1 minute
    challenges: parseInt(process.env.REDIS_CHALLENGES_TTL || '300', 10), // 5 minutes
    competitions: parseInt(process.env.REDIS_COMPETITIONS_TTL || '300', 10), // 5 minutes
    userProfile: parseInt(process.env.REDIS_USER_PROFILE_TTL || '600', 10), // 10 minutes
  },
  
  // Connection settings
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
}));