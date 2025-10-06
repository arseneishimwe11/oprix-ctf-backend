import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

/**
 * Events Service
 * Business logic for WebSocket events and real-time notifications
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private eventsGateway: EventsGateway) {}

  /**
   * Notify submission result
   */
  async notifySubmissionResult(submission: any) {
    await this.eventsGateway.sendSubmissionResult(submission.userId, submission);
    
    // DISABLED: First blood feature
    // Check for first blood
    // if (submission.isCorrect && submission.challenge?.firstBloodUserId === submission.userId) {
    //   await this.eventsGateway.sendFirstBloodNotification(
    //     submission.competitionId,
    //     submission.challenge,
    //     submission.user
    //   );
    // }
  }

  /**
   * Notify competition status change
   */
  async notifyCompetitionStatusChange(competitionId: string, status: string, message?: string) {
    await this.eventsGateway.sendCompetitionStatusChange(competitionId, status, message);
  }

  /**
   * Notify new challenge released
   */
  async notifyNewChallenge(competitionId: string, challenge: any) {
    await this.eventsGateway.sendNewChallengeNotification(competitionId, challenge);
  }

  /**
   * Notify user with notification
   */
  async notifyUser(userId: string, notification: any) {
    await this.eventsGateway.sendNotificationToUser(userId, notification);
  }

  /**
   * Notify competition with announcement
   */
  async notifyCompetitionAnnouncement(competitionId: string, announcement: any) {
    await this.eventsGateway.sendAnnouncementToCompetition(competitionId, announcement);
  }

  /**
   * Send team invitation notification
   */
  async notifyTeamInvitation(userId: string, team: any, inviterUsername: string) {
    await this.eventsGateway.sendTeamInvitation(userId, team, inviterUsername);
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(competitionId?: string): number {
    return this.eventsGateway.getConnectedUsersCount(competitionId);
  }

  /**
   * Broadcast maintenance message to all users
   */
  async broadcastMaintenance(message: string) {
    await this.eventsGateway.broadcastMaintenanceMessage(message);
  }
}