import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

/**
 * Admin Service (CTF Competition Organizer)
 * 
 * ROLE: Manages their own competitions and players
 * SCOPE: Only competitions created by this admin
 * 
 * RESPONSIBILITIES:
 * - Create and manage competitions
 * - Manage challenges for their competitions
 * - View players registered in THEIR competitions
 * - Monitor submissions for THEIR competitions
 * - Manage teams in THEIR competitions
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get players registered in admin's competitions
   */
  async getMyPlayers(adminId: string, filters?: { competitionId?: string; page?: number; limit?: number }) {
    const { competitionId, page = 1, limit = 50 } = filters || {};

    // First, get admin's competitions
    const adminCompetitions = await this.prisma.competition.findMany({
      where: { 
        ...(competitionId ? { id: competitionId } : {}),
      },
      select: { id: true },
    });

    const competitionIds = adminCompetitions.map(c => c.id);

    if (competitionIds.length === 0) {
      return {
        players: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where = {
      competitionId: { in: competitionIds },
    };

    const [registrations, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              isActive: true,
              createdAt: true,
            },
          },
          competition: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { registeredAt: 'desc' },
      }),
      this.prisma.registration.count({ where }),
    ]);

    return {
      players: registrations.map(reg => ({
        ...reg.user!,
        competition: reg.competition,
        registeredAt: reg.registeredAt,
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
   * Ban/Unban player from admin's competition
   */
  async togglePlayerBan(userId: string, competitionId: string, adminId: string) {
    // Verify admin owns this competition
    const competition = await this.prisma.competition.findFirst({
      where: { 
        id: competitionId,
      },
    });

    if (!competition) {
      throw new NotFoundException('Competition not found or access denied');
    }

    const registration = await this.prisma.registration.findFirst({
      where: {
        userId,
        competitionId,
      },
    });

    if (!registration) {
      throw new NotFoundException('Player not registered in this competition');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    this.logger.log(`Admin ${adminId} ${updated.isActive ? 'unbanned' : 'banned'} player ${userId} from competition ${competitionId}`);
    return updated;
  }

  /**
   * Get submissions for admin's competitions
   */
  async getMySubmissions(adminId: string, competitionId?: string, page = 1, limit = 50) {
    // Get admin's competition IDs
    const adminCompetitions = await this.prisma.competition.findMany({
      where: {
        ...(competitionId ? { id: competitionId } : {}),
      },
      select: { id: true },
    });

    const competitionIds = adminCompetitions.map(c => c.id);

    if (competitionIds.length === 0) {
      return {
        submissions: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where = { competitionId: { in: competitionIds } };

    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true },
          },
          challenge: {
            select: { id: true, title: true, points: true, category: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get statistics for admin's competition
   */
  async getMyCompetitionStats(competitionId: string, adminId: string) {
    const competition = await this.prisma.competition.findFirst({
      where: { id: competitionId },
    });

    if (!competition) {
      throw new NotFoundException('Competition not found or access denied');
    }

    const [participants, submissions, challenges, teams] = await Promise.all([
      this.prisma.registration.count({
        where: { competitionId, status: 'APPROVED' },
      }),
      this.prisma.submission.count({
        where: { competitionId },
      }),
      this.prisma.challenge.count({
        where: { competitionId },
      }),
      this.prisma.team.count({
        where: {
          competition: {
            id: competitionId,
          },
        },
      }),
    ]);

    const correctSubmissions = await this.prisma.submission.count({
      where: {
        competitionId,
        isCorrect: true,
      },
    });

    return {
      competition: {
        id: competition.id,
        name: competition.name,
        status: competition.status,
        startTime: competition.startTime,
        endTime: competition.endTime,
      },
      stats: {
        totalParticipants: participants,
        totalTeams: teams,
        totalChallenges: challenges,
        totalSubmissions: submissions,
        correctSubmissions,
        accuracy: submissions > 0 ? ((correctSubmissions / submissions) * 100).toFixed(2) + '%' : '0%',
      },
    };
  }

  /**
   * Get admin's dashboard overview
   */
  async getMyDashboard(adminId: string) {
    const [totalCompetitions, activeCompetitions, totalPlayers, totalSubmissions] = await Promise.all([
      this.prisma.competition.count(),
      this.prisma.competition.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.registration.count(),
      this.prisma.submission.count(),
    ]);

    // Recent competitions
    const recentCompetitions = await this.prisma.competition.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        startTime: true,
        endTime: true,
        _count: {
          select: {
            registrations: true,
            challenges: true,
          },
        },
      },
    });

    return {
      overview: {
        totalCompetitions,
        activeCompetitions,
        totalPlayers,
        totalSubmissions,
      },
      recentCompetitions,
    };
  }
}
