import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';

/**
 * Notifications Queue Service
 * Handles queuing notification jobs for background processing
 */
@Injectable()
export class NotificationsQueue {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  /**
   * Queue individual notification
   */
  async sendNotification(data: {
    userId: string;
    type: string;
    title: string;
    content: string;
  }) {
    await this.notificationsQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Queue bulk notifications
   */
  async sendBulkNotifications(data: {
    userIds: string[];
    type: string;
    title: string;
    content: string;
  }) {
    await this.notificationsQueue.add('bulk-notifications', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Queue competition announcement
   */
  async sendCompetitionAnnouncement(data: {
    competitionId: string;
    title: string;
    content: string;
  }) {
    await this.notificationsQueue.add('competition-announcement', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Queue team invitation
   */
  async sendTeamInvitation(data: {
    userId: string;
    teamId: string;
    inviterId: string;
  }) {
    await this.notificationsQueue.add('team-invitation', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Queue challenge release notification
   */
  async notifyChallengeRelease(data: {
    competitionId: string;
    challengeId: string;
    challengeTitle: string;
  }) {
    await this.notificationsQueue.add('challenge-release', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.notificationsQueue.getWaitingCount(),
      this.notificationsQueue.getActiveCount(),
      this.notificationsQueue.getCompletedCount(),
      this.notificationsQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }
}
