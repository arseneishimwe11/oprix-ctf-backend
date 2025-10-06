import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { AuthModule } from '../auth/auth.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { WebsocketsModule } from '../websockets/events.module';

/**
 * Submissions Module
 * Core CTF flag submission engine with rate limiting and scoring
 */
@Module({
  imports: [AuthModule, LeaderboardModule, WebsocketsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
