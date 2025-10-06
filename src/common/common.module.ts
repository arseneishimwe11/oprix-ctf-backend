import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Import all config files
import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import redisConfig from '../config/redis.config';
import queueConfig from '../config/queue.config';

// Import database module and services
import { DatabaseModule } from './database/database.module';
import { RateLimitService } from './services/rate-limit.service';
import { CryptoService } from './services/crypto.service';

/**
 * Common module - provides shared utilities across the application
 * Marked as Global so it's available everywhere
 */
@Global()
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, queueConfig],
      envFilePath: '.env',
      cache: true,
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
    
    // Database
    DatabaseModule,
  ],
  providers: [
    RateLimitService,
    CryptoService,
  ],
  exports: [
    ConfigModule, 
    ThrottlerModule, 
    DatabaseModule,
    RateLimitService,
    CryptoService,
  ],
})
export class CommonModule {}
