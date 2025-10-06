import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../../common/database/prisma.service';

/**
 * Cleanup Processor
 * Handles background cleanup tasks
 */
@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Clean up expired notifications
   */
  @Process('cleanup-notifications')
  async cleanupNotifications(job: Job) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired notifications`);
      return { success: true, deleted: result.count };
    } catch (error) {
      this.logger.error('Failed to cleanup notifications', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs (keep last 90 days)
   */
  @Process('cleanup-audit-logs')
  async cleanupAuditLogs(job: Job) {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old audit logs`);
      return { success: true, deleted: result.count };
    } catch (error) {
      this.logger.error('Failed to cleanup audit logs', error);
      throw error;
    }
  }

  /**
   * Clean up inactive teams (no members, older than 30 days)
   */
  @Process('cleanup-teams')
  async cleanupTeams(job: Job) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find teams with no members
      const teams = await this.prisma.team.findMany({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          isActive: false,
        },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      const teamsToDelete = teams.filter(t => t._count.members === 0);
      
      for (const team of teamsToDelete) {
        await this.prisma.team.delete({ where: { id: team.id } });
      }

      this.logger.log(`Cleaned up ${teamsToDelete.length} inactive teams`);
      return { success: true, deleted: teamsToDelete.length };
    } catch (error) {
      this.logger.error('Failed to cleanup teams', error);
      throw error;
    }
  }
}
