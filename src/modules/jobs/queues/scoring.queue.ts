import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';

/**
 * Scoring Queue Service
 * Handles queuing scoring-related jobs for background processing
 */
@Injectable()
export class ScoringQueue {
  constructor(
    @InjectQueue('scoring') private scoringQueue: Queue,
  ) {}

  /**
   * Queue score recalculation for a competition
   */
  async recalculateScores(competitionId: string) {
    await this.scoringQueue.add(
      'recalculate-scores',
      { competitionId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        priority: 1, // High priority
      },
    );
  }

  /**
   * Queue solve count update
   */
  async updateSolveCounts(competitionId: string) {
    await this.scoringQueue.add(
      'update-solve-counts',
      { competitionId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        priority: 2, // Medium priority
      },
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.scoringQueue.getWaitingCount(),
      this.scoringQueue.getActiveCount(),
      this.scoringQueue.getCompletedCount(),
      this.scoringQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }
}
