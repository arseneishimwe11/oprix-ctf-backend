import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import {
  UpdateChallengeDto,
  UpdateChallengeVisibilityDto,
  CreateHintDto,
  UnlockHintDto,
  ChallengeQueryDto,
} from './dto/update-challenge.dto';

/**
 * Challenges Service
 * Handles all challenge-related operations with competition ownership
 */
@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
  ) {}

  /**
   * Create a new challenge (Admin/Competition Owner only)
   * @param competitionId - Competition ID
   * @param createChallengeDto - Challenge data
   * @param userId - User creating the challenge
   */
  async create(competitionId: string, createChallengeDto: CreateChallengeDto, userId: string) {
    // Verify competition exists and user has permission
    const competition = await this.verifyCompetitionOwnership(competitionId, userId);

    // Prevent adding challenges to active/completed competitions
    if (competition.status === 'ACTIVE' || competition.status === 'COMPLETED') {
      throw new BadRequestException('Cannot add challenges to active or completed competition');
    }

    try {
      // SECURITY: Hash the flag securely - never store actual flag
      const { hash: flagHash, salt: flagSalt } = this.cryptoService.hashFlag(createChallengeDto.flag);
      
      const challenge = await this.prisma.challenge.create({
        data: {
          title: createChallengeDto.title,
          description: createChallengeDto.description,
          difficulty: createChallengeDto.difficulty,
          points: createChallengeDto.points,
          flagHash,          // SECURITY: Only store hash
          flagSalt,          // SECURITY: Only store salt  
          caseSensitive: createChallengeDto.caseSensitive || false,
          normalizeFlag: createChallengeDto.normalizeFlag ?? true,
          competitionId,
          // Create hints if provided
          hints: createChallengeDto.hints
            ? {
                create: createChallengeDto.hints.map((hint, index) => ({
                  content: hint,
                  cost: 0,
                  order: index + 1,
                  creatorId: userId,
                })),
              }
            : undefined,
        } as any, // Type assertion for schema migration in progress
        include: {
          hints: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      });

      this.logger.log(`Challenge created: ${challenge.title} in competition ${competitionId}`);
      return challenge;
    } catch (error) {
      this.logger.error('Failed to create challenge', error);
      throw new BadRequestException('Failed to create challenge');
    }
  }

  /**
   * Get all challenges in a competition
   * @param competitionId - Competition ID
   * @param query - Query filters
   * @param userId - User requesting challenges (for solve status)
   */
  async findAll(competitionId: string, query: ChallengeQueryDto, userId?: string) {
    // Verify competition exists
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
    });

    if (!competition) {
      throw new NotFoundException('Competition not found');
    }

    // Check if user is registered for the competition (if userId provided)
    if (userId) {
      const registration = await this.prisma.registration.findFirst({
        where: {
          competitionId,
          userId,
          status: 'APPROVED',
        },
      });

      if (!registration) {
        throw new ForbiddenException('You must be registered for this competition to view challenges');
      }
    }

    // Build where clause
    const where: any = { competitionId };
    
    // Non-admin users can only see visible challenges
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN' && competition.adminId !== userId) {
        where.isVisible = true;
      }
    } else {
      where.isVisible = true; // Public view only shows visible challenges
    }

    if (query.category) where.category = query.category;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const challenges = await this.prisma.challenge.findMany({
      where,
      include: {
        hints: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
        // Include correct submissions for current user
        submissions: userId
          ? {
              where: { 
                userId,
                isCorrect: true 
              },
              select: { id: true, createdAt: true },
            }
          : false,
      },
      orderBy: [{ points: 'asc' }, { createdAt: 'asc' }],
    });

    // Transform challenges to include solve status
    return challenges.map((challenge: any) => ({
      ...challenge,
      isSolved: userId ? challenge.submissions?.length > 0 : false,
      firstSolveAt: userId && challenge.submissions?.length > 0 ? challenge.submissions[0].createdAt : null,
      submissions: undefined, // Remove submission details from response
    }));
  }

  /**
   * Get a single challenge by ID
   * @param competitionId - Competition ID
   * @param challengeId - Challenge ID
   * @param userId - User requesting the challenge
   */
  async findOne(competitionId: string, challengeId: string, userId?: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: {
        id: challengeId,
        competitionId,
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            status: true,
            adminId: true,
          },
        },
        hints: {
          orderBy: { order: 'asc' },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
        submissions: userId
          ? {
              where: { 
                userId,
                isCorrect: true 
              },
              select: { id: true, createdAt: true },
            }
          : false,
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // Get competition info for ownership check
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      select: { adminId: true }
    });

    // Check if user can view this challenge
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
      const isOwner = competition?.adminId === userId;

      if (!isAdmin && !isOwner && !(challenge as any).isVisible) {
        throw new ForbiddenException('Challenge is not visible');
      }

      // Check registration for non-admins
      if (!isAdmin && !isOwner) {
        const registration = await this.prisma.registration.findFirst({
          where: {
            competitionId,
            userId,
            status: 'APPROVED',
          },
        });

        if (!registration) {
          throw new ForbiddenException('You must be registered for this competition');
        }
      }
    } else if (!(challenge as any).isVisible) {
      throw new ForbiddenException('Challenge is not visible');
    }

    // For now, skip hint unlocking (can be implemented later)
    const challengeWithIncludes = challenge as any;

    return {
      ...challenge,
      isSolved: userId ? challengeWithIncludes.submissions?.length > 0 : false,
      firstSolveAt: userId && challengeWithIncludes.submissions?.length > 0 ? challengeWithIncludes.submissions[0].createdAt : null,
      hints: challengeWithIncludes.hints?.map((hint: any) => ({
        id: hint.id,
        cost: hint.cost,
        order: hint.order,
        isUnlocked: false, // All hints locked by default for now
        content: undefined, // Don't show content for locked hints
      })) || [],
      submissions: undefined, // Remove submission details
      // SECURITY: Never expose flag data
      flag: undefined,
      flagHash: undefined,
      flagSalt: undefined
    };
  }

  /**
   * Update challenge (Admin/Owner only)
   * @param competitionId - Competition ID
   * @param challengeId - Challenge ID
   * @param updateChallengeDto - Update data
   * @param userId - User making the update
   */
  async update(
    competitionId: string,
    challengeId: string,
    updateChallengeDto: UpdateChallengeDto,
    userId: string,
  ) {
    await this.verifyCompetitionOwnership(competitionId, userId);
    
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, competitionId },
      include: { competition: true },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // Prevent editing if competition is active
    if (challenge.competition.status === 'ACTIVE' || challenge.competition.status === 'COMPLETED') {
      throw new BadRequestException('Cannot edit challenges in active or completed competition');
    }

    try {
      // Extract hints from DTO to handle separately
      const { hints, ...updateData } = updateChallengeDto;
      
      const updated = await this.prisma.challenge.update({
        where: { id: challengeId },
        data: updateData as any,
        include: {
          hints: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      });

      this.logger.log(`Challenge updated: ${updated.title}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update challenge', error);
      throw new BadRequestException('Failed to update challenge');
    }
  }

  /**
   * Delete challenge (Admin/Owner only)
   * @param competitionId - Competition ID
   * @param challengeId - Challenge ID
   * @param userId - User making the deletion
   */
  async remove(competitionId: string, challengeId: string, userId: string) {
    await this.verifyCompetitionOwnership(competitionId, userId);
    
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, competitionId },
      include: { competition: true },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // Prevent deletion if competition is active
    if (challenge.competition.status === 'ACTIVE' || challenge.competition.status === 'COMPLETED') {
      throw new BadRequestException('Cannot delete challenges from active or completed competition');
    }

    try {
      await this.prisma.challenge.delete({
        where: { id: challengeId },
      });

      this.logger.log(`Challenge deleted: ${challenge.title}`);
      return { message: 'Challenge deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete challenge', error);
      throw new BadRequestException('Failed to delete challenge');
    }
  }

  /**
   * Create hint for challenge
   * @param competitionId - Competition ID
   * @param challengeId - Challenge ID
   * @param createHintDto - Hint data
   * @param userId - User creating the hint
   */
  async createHint(
    competitionId: string,
    challengeId: string,
    createHintDto: CreateHintDto,
    userId: string,
  ) {
    await this.verifyCompetitionOwnership(competitionId, userId);
    
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, competitionId },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    try {
      const hint = await this.prisma.hint.create({
        data: {
          ...createHintDto,
          challengeId,
          creatorId: userId,
        },
      });

      this.logger.log(`Hint created for challenge: ${challenge.title}`);
      return hint;
    } catch (error) {
      this.logger.error('Failed to create hint', error);
      throw new BadRequestException('Failed to create hint');
    }
  }

  /**
   * Unlock hint (costs points)
   * @param competitionId - Competition ID
   * @param challengeId - Challenge ID
   * @param hintId - Hint ID
   * @param userId - User unlocking the hint
   */
  async unlockHint(competitionId: string, challengeId: string, hintId: string, userId: string) {
    // Verify user is registered
    const registration = await this.prisma.registration.findFirst({
      where: {
        competitionId,
        userId,
        status: 'APPROVED',
      },
    });

    if (!registration) {
      throw new ForbiddenException('You must be registered for this competition');
    }

    const hint = await this.prisma.hint.findFirst({
      where: { id: hintId, challengeId },
    });

    if (!hint) {
      throw new NotFoundException('Hint not found');
    }

    // For now, always allow hint unlocking (can implement proper unlock system later)
    // TODO: Implement hint unlock tracking system

    // Check if user has enough points
    const userScore = await this.prisma.score.aggregate({
      where: { userId, competitionId },
      _sum: { points: true },
    });

    const totalPoints = userScore._sum.points || 0;
    const hintCost = hint.cost || 0;
    if (totalPoints < hintCost) {
      throw new BadRequestException('Insufficient points to unlock hint');
    }

    try {
      // For now, just return the hint without deducting points
      // TODO: Implement proper hint unlock system with score tracking

      this.logger.log(`User ${userId} unlocked hint for ${hintCost} points`);
      return {
        hint: {
          id: hint.id,
          content: hint.content,
          cost: hintCost,
          order: hint.order,
        },
        pointsDeducted: hintCost,
      };
    } catch (error) {
      this.logger.error('Failed to unlock hint', error);
      throw new BadRequestException('Failed to unlock hint');
    }
  }

  /**
   * Verify competition ownership or admin access
   * @param competitionId - Competition ID
   * @param userId - User ID
   */
  private async verifyCompetitionOwnership(competitionId: string, userId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
    });

    if (!competition) {
      throw new NotFoundException('Competition not found');
    }

    // Check if user is owner or admin
    if (competition.adminId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        throw new ForbiddenException('Only competition owner or admins can perform this action');
      }
    }

    return competition;
  }
}
