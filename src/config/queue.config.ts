import { registerAs } from '@nestjs/config';
import { BullModuleOptions } from '@nestjs/bull';

export default registerAs('queue', (): BullModuleOptions => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_QUEUE_DB || '1', 10), // Different DB for queues
  },
  
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_JOB_ATTEMPTS || '3', 10),
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '1000', 10),
    },
    removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || '100', 10),
    removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || '50', 10),
  },
  
  settings: {
    stalledInterval: parseInt(process.env.QUEUE_STALLED_INTERVAL || '30000', 10),
    maxStalledCount: parseInt(process.env.QUEUE_MAX_STALLED_COUNT || '3', 10),
  },
}));