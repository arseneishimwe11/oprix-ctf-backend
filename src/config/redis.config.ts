import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    
    // Cache TTL settings (in seconds)
    ttl: {
      leaderboard: parseInt(process.env.REDIS_LEADERBOARD_TTL || '60', 10),
      challenges: parseInt(process.env.REDIS_CHALLENGES_TTL || '300', 10),
      competitions: parseInt(process.env.REDIS_COMPETITIONS_TTL || '300', 10),
      userProfile: parseInt(process.env.REDIS_USER_PROFILE_TTL || '600', 10),
    },
    
    // Connection settings
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };
  
  console.log('[Redis Config] Using:', { host: config.host, port: config.port, hasPassword: !!config.password });
  
  return config;
});