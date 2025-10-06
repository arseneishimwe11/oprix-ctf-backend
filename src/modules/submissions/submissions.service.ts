import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { RateLimitService } from '../../common/services/rate-limit.service';
import { CryptoService } from '../../common/services/crypto.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { EventsService } from '../websockets/events.service';
import {
  CreateSubmissionDto,
  SubmissionQueryDto,
  AdminSubmissionQueryDto,
} from './dto/create-submission.dto';

/**
 * Submissions Service
 * Core CTF engine for flag validation, scoring, and rate limiting
 * SECURITY-FIRST: Never stores actual flags, uses secure hashing
 */
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private prisma: PrismaService,
    private rateLimitService: RateLimitService,
    private cryptoService: CryptoService,
    private leaderboardService: LeaderboardService,
    private eventsService: EventsService,
  ) {}

  /**
   * Submit a flag (Rate limited: 5/min, timeout after 3 fails)
   * SECURITY: Uses secure flag validation, never stores actual flags
   * @param createSubmissionDto - Submission data
   * @param userId - User submitting the flag
   * @param ipAddress - User's IP address for audit trail
   * @param userAgent - User's user agent for audit trail
   */
  async submit(
    createSubmissionDto: CreateSubmissionDto, 
    userId: string, 
    ipAddress?: string, 
    userAgent?: string
  ) {
    const { challengeId, flag, teamId } = createSubmissionDto;

    // SECURITY: Rate limiting check (5/min)
    await this.rateLimitService.checkSubmissionRateLimit(userId);

    // Get challenge with validation
    const challenge = await this.getValidChallenge(challengeId, userId);

    // Check if user is registered for the competition
    await this.verifyRegistration(challenge.competitionId, userId, teamId);

    // Check if already solved by user/team
    await this.checkAlreadySolved(challengeId, userId, teamId);

    // SECURITY: Check submission timeout (after 3 consecutive failures)
    await this.rateLimitService.checkSubmissionTimeout(userId, challengeId);

    // SECURITY: Validate flag using secure hash comparison
    const challengeData = challenge as any; // Type assertion for new schema fields
    const isCorrect = this.cryptoService.verifyFlag(
      flag, 
      challengeData.flagHash, 
      challengeData.flagSalt, 
      challengeData.caseSensitive || false
    );

    try {
      // Create submission record (NEVER stores actual flag)
      const submission = await this.prisma.submission.create({
        data: {
          challengeId,
          userId,
          teamId,
          competitionId: challenge.competitionId,
          isCorrect,
          ipAddress,
          userAgent,
          submittedAt: new Date(),
        } as any, // Type assertion due to schema migration in progress
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              points: true,
              category: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          team: teamId
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : undefined,
        },
      });

      // If correct submission, award points and create solve record
      if (isCorrect) {
        await this.handleCorrectSubmission(submission);
        
        // Invalidate leaderboard cache for real-time updates
        await this.leaderboardService.invalidateCache(challenge.competitionId);
        
        // Broadcast leaderboard update via WebSocket
        await this.eventsService.notifySubmissionResult(submission);
      }

      // SECURITY: Track submission attempts for timeout mechanism
      await this.rateLimitService.trackSubmissionAttempt(userId, challengeId, isCorrect);

      this.logger.log(
        `Submission ${isCorrect ? 'CORRECT' : 'INCORRECT'}: ${challenge.title} by ${userId}`,
      );

      return {
        id: submission.id,
        challengeId: submission.challengeId,
        isCorrect: submission.isCorrect,
        submittedAt: submission.submittedAt,
        challenge: (submission as any).challenge || {
          id: challenge.id,
          title: challenge.title,
          points: challenge.points,
          category: challenge.category,
        },
        user: (submission as any).user,
        team: (submission as any).team,
        // SECURITY: Never return flag or any sensitive data
        message: isCorrect 
          ? 'Correct flag! Points awarded.' 
          : 'Incorrect flag. Try again.',
        pointsAwarded: isCorrect ? challenge.points : 0,
      };
    } catch (error) {
      this.logger.error('Failed to create submission', error);
      throw new BadRequestException('Failed to submit flag');
    }
  }

  /**
   * Get user's submissions
   * @param userId - User ID
   * @param query - Query parameters
   */
  async findUserSubmissions(userId: string, query: SubmissionQueryDto) {
    const { page = 1, limit = 20, challengeId, competitionId, correctOnly, incorrectOnly } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    if (challengeId) where.challengeId = challengeId;
    if (competitionId) where.competitionId = competitionId;
    if (correctOnly) where.isCorrect = true;
    if (incorrectOnly) where.isCorrect = false;

    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              category: true,
              points: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      data: submissions.map((submission) => ({
        ...submission,
        flag: undefined, // Never expose flags to users
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single submission by ID
   * @param id - Submission ID
   * @param userId - User requesting (for ownership check)
   */
  async findOne(id: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            category: true,
            points: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check ownership or admin access
    if (submission.userId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      ...submission,
      flag: undefined, // Never expose flags except to admins
    };
  }

  /**
   * Get all submissions (Admin only)
   * @param query - Admin query parameters
   * @param adminId - Admin user ID
   */
  async findAllAdmin(query: AdminSubmissionQueryDto, adminId: string) {
    // Verify admin access
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (admin?.role !== 'ADMIN' && admin?.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const {
      page = 1,
      limit = 20,
      challengeId,
      competitionId,
      userId,
      teamId,
      correctOnly,
      incorrectOnly,
    } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (challengeId) where.challengeId = challengeId;
    if (competitionId) where.competitionId = competitionId;
    if (userId) where.userId = userId;
    if (teamId) where.teamId = teamId;
    if (correctOnly) where.isCorrect = true;
    if (incorrectOnly) where.isCorrect = false;

    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              category: true,
              points: true,
              // SECURITY: Never include flags in any response
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      data: submissions.map((submission) => ({
        ...submission,
        // SECURITY: Never expose flags in any response
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  /**
   * Get challenge with validation and security data
   * @param challengeId - Challenge ID
   * @param userId - User ID
   */
  private async getValidChallenge(challengeId: string, userId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        competition: {
          select: {
            id: true,
            status: true,
            endTime: true,
          },
        },
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    if (!challenge.isVisible) {
      throw new ForbiddenException('Challenge is not visible');
    }

    // Check if competition is active
    if ((challenge as any).competition.status !== 'ACTIVE') {
      throw new BadRequestException('Competition is not active');
    }

    // Check if competition has ended
    if (new Date() > challenge.competition.endTime) {
      throw new BadRequestException('Competition has ended');
    }

    return challenge;
  }

  /**
   * Verify user is registered for the competition
   * @param competitionId - Competition ID
   * @param userId - User ID
   * @param teamId - Team ID (optional)
   */
  private async verifyRegistration(competitionId: string, userId: string, teamId?: string) {
    const registration = await this.prisma.registration.findFirst({
      where: {
        competitionId,
        userId,
        status: 'APPROVED',
        ...(teamId && { teamId }),
      },
    });

    if (!registration) {
      throw new ForbiddenException('You must be registered for this competition');
    }
  }

  /**
   * Check if challenge is already solved by user/team
   * @param challengeId - Challenge ID
   * @param userId - User ID
   * @param teamId - Team ID (optional)
   */
  private async checkAlreadySolved(challengeId: string, userId: string, teamId?: string) {
    const existingSolve = await this.prisma.submission.findFirst({
      where: {
        challengeId,
        isCorrect: true,
        ...(teamId ? { teamId } : { userId }),
      },
    });

    if (existingSolve) {
      throw new ConflictException('Challenge already solved');
    }
  }


  /**
   * Handle correct submission - award points and create solve record
   * @param submission - Submission object
   */
  private async handleCorrectSubmission(submission: any) {
    const points = submission.challenge.points;

    try {
      // Use transaction to ensure consistency
      await this.prisma.$transaction([
        // Create score record
        this.prisma.score.create({
          data: {
            userId: submission.userId,
            teamId: submission.teamId,
            competitionId: submission.competitionId,
            challengeId: submission.challengeId,
            submissionId: submission.id,
            points,
            solvedAt: new Date(),
          } as any,
        }),
        // Update challenge solve count
        this.prisma.challenge.update({
          where: { id: submission.challengeId },
          data: {
            solveCount: {
              increment: 1,
            },
          },
        }),
      ]);

      // Mark challenge as solved in Redis for performance
      await this.rateLimitService.markChallengeSolved(submission.userId, submission.challengeId);

      this.logger.log(
        `Points awarded: ${points} to user ${submission.userId} for solving ${submission.challenge.title}`,
      );
    } catch (error) {
      this.logger.error('Failed to handle correct submission', error);
      throw new BadRequestException('Failed to process correct submission');
    }
  }
}
