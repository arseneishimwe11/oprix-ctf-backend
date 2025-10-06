import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../../common/database/prisma.service';
import { EventsService } from '../../websockets/events.service';

/**
 * Notification Processor
 * Handles background notification delivery via WebSocket and database
 */
@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  /**
   * Process individual notification
   */
  @Process('send-notification')
  async handleNotification(job: Job) {
    const { userId, type, title, content } = job.data;

    try {
      const notification = await this.prisma.notification.create({
        data: { userId, type, title, content, isRead: false } as any,
      });

      await this.eventsService.notifyUser(userId, notification);
      this.logger.log(`Notification sent to user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Notification failed', error);
      throw error;
    }
  }

  /**
   * Process bulk notifications
   */
  @Process('send-bulk-notifications')
  async handleBulkNotifications(job: Job) {
    const { userIds, type, title, content } = job.data;

    try {
      // Create notifications in batch
      const notifications = await this.prisma.notification.createMany({
        data: userIds.map((userId: string) => ({
          userId,
          type,
          title,
          content,
          isRead: false,
        })) as any,
      });

      // Send via WebSocket to all users
      await Promise.all(
        userIds.map((userId: string) => 
          this.eventsService.notifyUser(userId, { type, title, content })
        ),
      );

      this.logger.log(`Bulk notifications sent to ${userIds.length} users: ${title}`);
      return { success: true, count: userIds.length };
    } catch (error) {
      this.logger.error('Failed to send bulk notifications', error);
      throw error;
    }
  }

  /**
   * Process competition announcement
   * Sends to all registered participants
   */
  @Process('competition-announcement')
  async handleCompetitionAnnouncement(job: Job) {
    const { competitionId, title, message } = job.data;

    try {
      // Get all registered users for the competition
      const registrations = await this.prisma.registration.findMany({
        where: { competitionId },
        select: { userId: true },
      });

      const userIds = registrations.map(r => r.userId);

      if (userIds.length === 0) {
        this.logger.warn(`No users registered for competition ${competitionId}`);
        return { success: true, count: 0 };
      }

      // Create notifications
      await this.prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: 'COMPETITION_ANNOUNCEMENT',
          title,
          content: message,
          isRead: false,
        })) as any,
      });

      // Broadcast via WebSocket
      await this.eventsService.notifyCompetitionAnnouncement(competitionId, {
        title,
        message,
        timestamp: new Date(),
      });

      this.logger.log(`Competition announcement sent to ${userIds.length} users`);
      return { success: true, count: userIds.length };
    } catch (error) {
      this.logger.error('Failed to send competition announcement', error);
      throw error;
    }
  }

  /**
   * Process team invitation notification
   */
  @Process('team-invitation')
  async handleTeamInvitation(job: Job) {
    const { userId, teamId, teamName, inviterUsername } = job.data;

    try {
      // Create notification
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type: 'TEAM_INVITATION',
          title: 'Team Invitation',
          content: `${inviterUsername} invited you to join team "${teamName}"`,
          isRead: false,
        } as any,
      });

      // Send via WebSocket
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, name: true, description: true },
      });

      await this.eventsService.notifyTeamInvitation(userId, team, inviterUsername);

      this.logger.log(`Team invitation sent to user ${userId}`);
      return { success: true, notificationId: notification.id };
    } catch (error) {
      this.logger.error('Failed to send team invitation', error);
      throw error;
    }
  }

  /**
   * Process challenge release notification
   */
  @Process('challenge-release')
  async handleChallengeRelease(job: Job) {
    const { competitionId, challengeId, challengeTitle } = job.data;

    try {
      // Get all registered users
      const registrations = await this.prisma.registration.findMany({
        where: { competitionId },
        select: { userId: true },
      });

      const userIds = registrations.map(r => r.userId);

      // Create notifications
      await this.prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: 'CHALLENGE_RELEASED',
          title: 'New Challenge Released',
          content: `A new challenge "${challengeTitle}" is now available!`,
          isRead: false,
        })) as any,
      });

      // Broadcast via WebSocket
      const challenge = await this.prisma.challenge.findUnique({
        where: { id: challengeId },
      });

      await this.eventsService.notifyNewChallenge(competitionId, challenge);

      this.logger.log(`Challenge release notification sent to ${userIds.length} users`);
      return { success: true, count: userIds.length };
    } catch (error) {
      this.logger.error('Failed to send challenge release notification', error);
      throw error;
    }
  }
}
