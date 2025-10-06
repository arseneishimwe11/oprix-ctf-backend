import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../../common/database/prisma.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';

/**
 * Scoring Processor
 * Handles score recalculation and leaderboard updates
 */
@Processor('scoring')
export class ScoringProcessor {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private prisma: PrismaService,
    private leaderboardService: LeaderboardService,
  ) {}

  /**
   * Recalculate scores for a competition
   */
  @Process('recalculate-scores')
  async recalculateScores(job: Job) {
    const { competitionId } = job.data;

    try {
      // Get all correct submissions for the competition
      const submissions = await this.prisma.submission.findMany({
        where: {
          competitionId,
          isCorrect: true,
        },
        include: {
          challenge: {
            select: { points: true },
          },
        },
        orderBy: { submittedAt: 'asc' },
      });

      // Group by user/team and recreate scores
      const userScores = new Map<string, any[]>();
      const teamScores = new Map<string, any[]>();

      for (const submission of submissions) {
        const key = submission.userId || submission.teamId!;
        const map = submission.userId ? userScores : teamScores;
        
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(submission);
      }

      // Delete existing scores
      await this.prisma.score.deleteMany({ where: { competitionId } });

      // Recreate scores
      const scoresToCreate: any[] = [];
      
      for (const [userId, subs] of userScores.entries()) {
        for (const sub of subs) {
          scoresToCreate.push({
            userId,
            challengeId: sub.challengeId,
            competitionId,
            submissionId: sub.id,
            points: sub.challenge.points,
            solvedAt: sub.submittedAt,
          });
        }
      }

      for (const [teamId, subs] of teamScores.entries()) {
        for (const sub of subs) {
          scoresToCreate.push({
            teamId,
            challengeId: sub.challengeId,
            competitionId,
            submissionId: sub.id,
            points: sub.challenge.points,
            solvedAt: sub.submittedAt,
          });
        }
      }

      if (scoresToCreate.length > 0) {
        await this.prisma.score.createMany({ data: scoresToCreate });
      }

      // Invalidate leaderboard cache
      await this.leaderboardService.invalidateCache(competitionId);

      this.logger.log(`Recalculated ${scoresToCreate.length} scores for competition ${competitionId}`);
      return { success: true, scoresRecalculated: scoresToCreate.length };
    } catch (error) {
      this.logger.error('Failed to recalculate scores', error);
      throw error;
    }
  }

  /**
   * Update challenge solve counts
   */
  @Process('update-solve-counts')
  async updateSolveCounts(job: Job) {
    const { competitionId } = job.data;

    try {
      const challenges = await this.prisma.challenge.findMany({
        where: { competitionId },
        select: { id: true },
      });

      for (const challenge of challenges) {
        const count = await this.prisma.submission.count({
          where: {
            challengeId: challenge.id,
            isCorrect: true,
          },
        });

        await this.prisma.challenge.update({
          where: { id: challenge.id },
          data: { solveCount: count },
        });
      }

      this.logger.log(`Updated solve counts for ${challenges.length} challenges`);
      return { success: true, updatedCount: challenges.length };
    } catch (error) {
      this.logger.error('Failed to update solve counts', error);
      throw error;
    }
  }
}
