import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

/**
 * Metrics Service
 * Provides system metrics for monitoring and analytics
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    const [users, competitions, challenges, submissions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.competition.count(),
      this.prisma.challenge.count(),
      this.prisma.submission.count(),
    ]);

    return {
      totalUsers: users,
      totalCompetitions: competitions,
      totalChallenges: challenges,
      totalSubmissions: submissions,
      timestamp: new Date(),
    };
  }

  /**
   * Get active competitions count
   */
  async getActiveCompetitions() {
    return this.prisma.competition.count({
      where: { status: 'ACTIVE' },
    });
  }

  /**
   * Get submission rate (last hour)
   */
  async getSubmissionRate() {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const count = await this.prisma.submission.count({
      where: {
        createdAt: { gte: oneHourAgo },
      },
    });

    return {
      submissionsLastHour: count,
      avgPerMinute: Math.round(count / 60),
    };
  }
}
