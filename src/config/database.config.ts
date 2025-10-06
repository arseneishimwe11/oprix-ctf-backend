import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  
  // Prisma connection pool settings
  connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),
  poolTimeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || '60', 10),
  
  // Query logging
  logQueries: process.env.DATABASE_LOG_QUERIES === 'true',
  logLevel: process.env.DATABASE_LOG_LEVEL || 'error',
}));