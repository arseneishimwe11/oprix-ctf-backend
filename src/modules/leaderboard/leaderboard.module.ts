import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Leaderboard Module
 * Handles real-time CTF rankings with caching
 */
@Module({
  imports: [AuthModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
