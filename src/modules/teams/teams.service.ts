import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import {
  CreateTeamDto,
  JoinTeamDto,
  InviteTeamMemberDto,
  KickTeamMemberDto,
  TransferCaptaincyDto,
} from './dto/create-team.dto';
import { UpdateTeamDto, TeamQueryDto } from './dto/update-team.dto';
import { randomBytes } from 'crypto';

/**
 * Teams Service
 * Handles team creation, membership, and management for CTF competitions
 */
@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new team
   * @param createTeamDto - Team creation data
   * @param captainId - User creating the team (becomes captain)
   */
  async create(createTeamDto: CreateTeamDto, captainId: string) {
    // Check if user is already captain of another team
    const existingTeam = await this.prisma.team.findFirst({
      where: { captainId },
    });

    if (existingTeam) {
      throw new ConflictException('You are already a captain of another team');
    }

    // Check if user is already a member of another team
    const existingMembership = await this.prisma.teamMember.findFirst({
      where: { userId: captainId },
    });

    if (existingMembership) {
      throw new ConflictException('You are already a member of another team');
    }

    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    try {
      const team = await this.prisma.$transaction(async (tx) => {
        // Create team
        const newTeam = await tx.team.create({
          data: {
            name: createTeamDto.name,
            description: createTeamDto.description,
            maxSize: createTeamDto.maxSize || 4,
            captainId,
            inviteCode,
            competitionId: createTeamDto.competitionId,
          },
          include: {
            captain: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        });

        // Add captain as first team member
        await tx.teamMember.create({
          data: {
            teamId: newTeam.id,
            userId: captainId,
            role: 'CAPTAIN',
            joinedAt: new Date(),
          },
        });

        return newTeam;
      });

      this.logger.log(`Team created: ${team.name} by ${captainId}`);
      return {
        ...team,
        memberCount: 1,
        availableSlots: team.maxSize - 1,
      };
    } catch (error) {
      this.logger.error('Failed to create team', error);
      throw new BadRequestException('Failed to create team');
    }
  }

  /**
   * Get all teams with optional filtering
   * @param query - Query parameters
   */
  async findAll(query: TeamQueryDto) {
    const { page = 1, limit = 20, search, competitionId, availableOnly } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (competitionId) {
      where.registrations = {
        some: { competitionId },
      };
    }

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        include: {
          captain: {
            select: {
              id: true,
              username: true,
            },
          },
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
              role: true,
              joinedAt: true,
            },
          },
          _count: {
            select: {
              members: true,
              registrations: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.team.count({ where }),
    ]);

    // Filter teams with available slots if requested
    let filteredTeams = teams;
    if (availableOnly) {
      filteredTeams = teams.filter((team) => (team as any)._count.members < team.maxSize);
    }

    const processedTeams = filteredTeams.map((team) => {
      const teamWithCount = team as any;
      return {
        ...team,
        memberCount: teamWithCount._count.members,
        availableSlots: team.maxSize - teamWithCount._count.members,
        competitionCount: teamWithCount._count.registrations,
        inviteCode: undefined, // Don't expose invite codes in public listings
      };
    });

    return {
      data: processedTeams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get team by ID
   * @param id - Team ID
   * @param userId - User requesting (for permission checks)
   */
  async findOne(id: string, userId?: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        captain: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        registrations: {
          include: {
            competition: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            registrations: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user is team member for invite code access
    const isMember = userId && team.members.some((member) => member.userId === userId);
    const isCaptain = userId && team.captainId === userId;

    const teamWithCount = team as any;
    return {
      ...team,
      memberCount: teamWithCount._count.members,
      availableSlots: team.maxSize - teamWithCount._count.members,
      competitionCount: teamWithCount._count.registrations,
      inviteCode: isMember ? team.inviteCode : undefined, // Only show invite code to members
      canEdit: isCaptain,
      canLeave: isMember && !isCaptain,
      canKick: isCaptain,
    };
  }

  /**
   * Update team details (Captain only)
   * @param id - Team ID
   * @param updateTeamDto - Update data
   * @param userId - User making the update
   */
  async update(id: string, updateTeamDto: UpdateTeamDto, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            competition: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only team captain can update team details');
    }

    // Check if team is in active competition
    const hasActiveCompetitions = team.registrations.some(
      (reg) => reg.competition.status === 'ACTIVE',
    );

    if (hasActiveCompetitions) {
      throw new BadRequestException('Cannot edit team details during active competitions');
    }

    try {
      const updatedTeam = await this.prisma.team.update({
        where: { id },
        data: updateTeamDto,
        include: {
          captain: {
            select: {
              id: true,
              username: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      this.logger.log(`Team updated: ${updatedTeam.name} by ${userId}`);
      const teamWithCount = updatedTeam as any;
      return {
        ...updatedTeam,
        memberCount: teamWithCount._count.members,
        availableSlots: updatedTeam.maxSize - teamWithCount._count.members,
      };
    } catch (error) {
      this.logger.error('Failed to update team', error);
      throw new BadRequestException('Failed to update team');
    }
  }

  /**
   * Delete team (Captain only, before competitions start)
   * @param id - Team ID
   * @param userId - User requesting deletion
   */
  async remove(id: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            competition: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only team captain can delete the team');
    }

    // Check if team has any active or completed competitions
    const hasActiveCompetitions = team.registrations.some(
      (reg) => reg.competition.status === 'ACTIVE' || reg.competition.status === 'COMPLETED',
    );

    if (hasActiveCompetitions) {
      throw new BadRequestException('Cannot delete team with active or completed competitions');
    }

    try {
      await this.prisma.team.delete({
        where: { id },
      });

      this.logger.log(`Team deleted: ${team.name} by ${userId}`);
      return { message: 'Team deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete team', error);
      throw new BadRequestException('Failed to delete team');
    }
  }

  /**
   * Join team with invite code
   * @param joinTeamDto - Join team data
   * @param userId - User joining the team
   */
  async joinTeam(joinTeamDto: JoinTeamDto, userId: string) {
    const { inviteCode } = joinTeamDto;

    // Find team by invite code
    const team = await this.prisma.team.findUnique({
      where: { inviteCode },
      include: {
        members: true,
        registrations: {
          include: {
            competition: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Invalid invite code');
    }

    // Check if user is already a member of this team
    const existingMember = team.members.find((member) => member.userId === userId);
    if (existingMember) {
      throw new ConflictException('You are already a member of this team');
    }

    // Check if user is already a member of another team
    const existingMembership = await this.prisma.teamMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException('You are already a member of another team');
    }

    // Check if team is full
    if (team.members.length >= team.maxSize) {
      throw new BadRequestException('Team is full');
    }

    // Check if team is in active competition (cannot join during active competition)
    const hasActiveCompetitions = team.registrations.some(
      (reg) => reg.competition.status === 'ACTIVE',
    );

    if (hasActiveCompetitions) {
      throw new BadRequestException('Cannot join team during active competitions');
    }

    try {
      const teamMember = await this.prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          role: 'MEMBER',
          joinedAt: new Date(),
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      this.logger.log(`User ${userId} joined team ${team.name}`);
      return {
        message: 'Successfully joined team',
        team: teamMember.team,
        joinedAt: teamMember.joinedAt,
      };
    } catch (error) {
      this.logger.error('Failed to join team', error);
      throw new BadRequestException('Failed to join team');
    }
  }

  /**
   * Leave team (Members only, not during active competitions)
   * @param teamId - Team ID
   * @param userId - User leaving the team
   */
  async leaveTeam(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        registrations: {
          include: {
            competition: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user is a member
    const membership = team.members.find((member) => member.userId === userId);
    if (!membership) {
      throw new BadRequestException('You are not a member of this team');
    }

    // Captain cannot leave (must transfer captaincy first)
    if (team.captainId === userId) {
      throw new BadRequestException('Captain cannot leave team. Transfer captaincy first.');
    }

    // Check if team is in active competition
    const hasActiveCompetitions = team.registrations.some(
      (reg) => reg.competition.status === 'ACTIVE',
    );

    if (hasActiveCompetitions) {
      throw new BadRequestException('Cannot leave team during active competitions');
    }

    try {
      await this.prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      this.logger.log(`User ${userId} left team ${team.name}`);
      return { message: 'Successfully left team' };
    } catch (error) {
      this.logger.error('Failed to leave team', error);
      throw new BadRequestException('Failed to leave team');
    }
  }

  /**
   * Kick team member (Captain only, not during active competitions)
   * @param teamId - Team ID
   * @param kickTeamMemberDto - Kick member data
   * @param captainId - Captain kicking the member
   */
  async kickMember(teamId: string, kickTeamMemberDto: KickTeamMemberDto, captainId: string) {
    const { userId, reason } = kickTeamMemberDto;

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        registrations: {
          include: {
            competition: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== captainId) {
      throw new ForbiddenException('Only team captain can kick members');
    }

    // Cannot kick self
    if (userId === captainId) {
      throw new BadRequestException('Captain cannot kick themselves');
    }

    // Check if target user is a member
    const membership = team.members.find((member) => member.userId === userId);
    if (!membership) {
      throw new BadRequestException('User is not a member of this team');
    }

    // Check if team is in active competition
    const hasActiveCompetitions = team.registrations.some(
      (reg) => reg.competition.status === 'ACTIVE',
    );

    if (hasActiveCompetitions) {
      throw new BadRequestException('Cannot kick members during active competitions');
    }

    try {
      await this.prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      this.logger.log(`User ${userId} kicked from team ${team.name} by ${captainId}. Reason: ${reason}`);
      return { message: 'Member kicked successfully' };
    } catch (error) {
      this.logger.error('Failed to kick member', error);
      throw new BadRequestException('Failed to kick member');
    }
  }

  /**
   * Transfer team captaincy (Captain only)
   * @param teamId - Team ID
   * @param transferCaptaincyDto - Transfer data
   * @param currentCaptainId - Current captain
   */
  async transferCaptaincy(teamId: string, transferCaptaincyDto: TransferCaptaincyDto, currentCaptainId: string) {
    const { newCaptainId } = transferCaptaincyDto;

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        registrations: {
          include: {
            competition: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== currentCaptainId) {
      throw new ForbiddenException('Only current captain can transfer captaincy');
    }

    // SECURITY: Check if team is in active competition
    const hasActiveCompetitions = team.registrations.some(
      (reg) => reg.competition.status === 'ACTIVE',
    );

    if (hasActiveCompetitions) {
      throw new BadRequestException('Cannot transfer captaincy during active competitions');
    }

    // Check if new captain is a member
    const newCaptainMembership = team.members.find((member) => member.userId === newCaptainId);
    if (!newCaptainMembership) {
      throw new BadRequestException('New captain must be a team member');
    }

    try {
      await this.prisma.$transaction([
        // Update team captain
        this.prisma.team.update({
          where: { id: teamId },
          data: { captainId: newCaptainId },
        }),
        // Update old captain role
        this.prisma.teamMember.update({
          where: {
            teamId_userId: {
              teamId,
              userId: currentCaptainId,
            },
          },
          data: { role: 'MEMBER' },
        }),
        // Update new captain role
        this.prisma.teamMember.update({
          where: {
            teamId_userId: {
              teamId,
              userId: newCaptainId,
            },
          },
          data: { role: 'CAPTAIN' },
        }),
      ]);

      this.logger.log(`Captaincy transferred from ${currentCaptainId} to ${newCaptainId} for team ${team.name}`);
      return { message: 'Captaincy transferred successfully' };
    } catch (error) {
      this.logger.error('Failed to transfer captaincy', error);
      throw new BadRequestException('Failed to transfer captaincy');
    }
  }

  /**
   * Get team statistics
   * @param teamId - Team ID
   */
  async getTeamStats(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        registrations: {
          include: {
            competition: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Get total points
    const totalPoints = await this.prisma.score.aggregate({
      where: { teamId },
      _sum: { points: true },
    });

    // Get challenges solved
    const challengesSolved = await this.prisma.submission.count({
      where: {
        teamId,
        isCorrect: true,
      },
    });

    // Competition stats
    const completedCompetitions = team.registrations.filter(
      (reg) => reg.competition.status === 'COMPLETED',
    ).length;

    // Calculate wins (need to implement ranking logic)
    const competitionWins = 0; // TODO: Implement based on leaderboard rankings

    return {
      totalPoints: totalPoints._sum.points || 0,
      challengesSolved,
      competitionsParticipated: team.registrations.length,
      competitionWins,
      currentSize: team.members.length,
      maxSize: team.maxSize,
    };
  }

  /**
   * Generate unique invite code
   */
  private generateInviteCode(): string {
    return randomBytes(4).toString('hex').toLowerCase();
  }
}
