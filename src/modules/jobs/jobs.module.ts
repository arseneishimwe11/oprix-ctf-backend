import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationProcessor } from './processors/notification.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { ScoringProcessor } from './processors/scoring.processor';
import { NotificationsQueue } from './queues/notifications.queue';
import { ScoringQueue } from './queues/scoring.queue';
import { WebsocketsModule } from '../websockets/events.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [
    // Register Bull queues
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'scoring' },
      { name: 'cleanup' },
    ),
    WebsocketsModule,
    LeaderboardModule,
  ],
  providers: [
    // Processors
    NotificationProcessor,
    CleanupProcessor,
    ScoringProcessor,
    // Queue services
    NotificationsQueue,
    ScoringQueue,
  ],
  exports: [
    NotificationsQueue,
    ScoringQueue,
  ],
})
export class JobsModule {}