import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import {
  UpdateCompetitionDto,
  UpdateCompetitionStatusDto,
  RegisterCompetitionDto,
} from './dto/update-competition.dto';
import { CompetitionQueryDto } from './dto/competition-query.dto';

/**
 * Competitions Service
 * Handles all competition-related operations
 */
@Injectable()
export class CompetitionsService {
  private readonly logger = new Logger(CompetitionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new competition (Admin only)
   * @param createCompetitionDto - Competition data
   * @param adminId - ID of admin creating the competition
   */
  async create(createCompetitionDto: CreateCompetitionDto, adminId: string) {
    // Validate dates
    const startTime = new Date(createCompetitionDto.startTime);
    const endTime = new Date(createCompetitionDto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    if (startTime < new Date()) {
      throw new BadRequestException('Start time cannot be in the past');
    }

    try {
      const competition = await this.prisma.competition.create({
        data: {
          name: createCompetitionDto.name,
          title: createCompetitionDto.name,
          description: createCompetitionDto.description,
          startDate: startTime,
          endDate: endTime,
          startTime: startTime,
          endTime: endTime,
          status: 'DRAFT',
          isTeamBased: createCompetitionDto.isTeamBased || false,
          isPublic: createCompetitionDto.isPublic ?? true,
          adminId,
        },
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(`Competition created: ${competition.title} by ${adminId}`);
      return competition;
    } catch (error) {
      this.logger.error('Failed to create competition', error);
      throw new BadRequestException('Failed to create competition');
    }
  }

  /**
   * Get all competitions with pagination and filters
   * @param query - Query parameters
   * @param userId - Optional user ID for filtering user's competitions
   */
  async findAll(query: CompetitionQueryDto, userId?: string) {
    const { page = 1, limit = 20, status, type, isPublic, search, myCompetitions } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (isPublic !== undefined) where.isPublic = isPublic;
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by user's registrations
    if (myCompetitions && userId) {
      where.registrations = {
        some: { userId },
      };
    }

    const [competitions, total] = await Promise.all([
      this.prisma.competition.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          _count: {
            select: {
              challenges: true,
              registrations: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.competition.count({ where }),
    ]);

    return {
      data: competitions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single competition by ID
   * @param id - Competition ID
   * @param userId - Optional user ID to include registration status
   */
  async findOne(id: string, userId?: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        challenges: {
          select: {
            id: true,
            title: true,
            category: true,
            points: true,
            difficulty: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    // Check if user is registered
    let userRegistration: any = null;
    if (userId) {
      userRegistration = await this.prisma.registration.findFirst({
        where: {
          competitionId: id,
          userId,
        },
      });
    }

    return {
      ...(competition as any),
      isRegistered: !!userRegistration,
      registrationStatus: userRegistration?.status ?? null,
    };
  }

  /**
   * Update competition details (Admin/Owner only)
   * @param id - Competition ID
   * @param updateCompetitionDto - Update data
   * @param userId - ID of user making the update
   */
  async update(id: string, updateCompetitionDto: UpdateCompetitionDto, userId: string) {
    const competition = await this.findOne(id);

    // Check ownership or admin rights
    if (competition.adminId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'SUPERADMIN') {
        throw new ForbiddenException('Only the competition owner or SuperAdmin can update this competition');
      }
    }

    // Prevent editing if competition is active or completed
    if (competition.status === 'ACTIVE' || competition.status === 'COMPLETED') {
      throw new BadRequestException(`Cannot update ${competition.status.toLowerCase()} competition`);
    }

    // Validate dates if provided
    if (updateCompetitionDto.startTime || updateCompetitionDto.endTime) {
      const startTime = updateCompetitionDto.startTime 
        ? new Date(updateCompetitionDto.startTime)
        : competition.startDate;
      const endTime = updateCompetitionDto.endTime
        ? new Date(updateCompetitionDto.endTime)
        : competition.endDate;

      if (endTime <= startTime) {
        throw new BadRequestException('End time must be after start time');
      }
    }

    try {
      const updated = await this.prisma.competition.update({
        where: { id },
        data: {
          ...updateCompetitionDto,
          startTime: updateCompetitionDto.startTime ? new Date(updateCompetitionDto.startTime) : undefined,
          endTime: updateCompetitionDto.endTime ? new Date(updateCompetitionDto.endTime) : undefined,
        },
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(`Competition updated: ${updated.title}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update competition', error);
      throw new BadRequestException('Failed to update competition');
    }
  }

  /**
   * Update competition status (Admin/Owner only)
   * @param id - Competition ID
   * @param statusDto - Status update data
   * @param userId - ID of user making the update
   */
  async updateStatus(id: string, statusDto: UpdateCompetitionStatusDto, userId: string) {
    const competition = await this.findOne(id);

    // Check ownership or admin rights
    if (competition.adminId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        throw new ForbiddenException('Only admins can change competition status');
      }
    }

    // Validate status transitions
    this.validateStatusTransition(competition.status, statusDto.status);

    try {
      const updated = await this.prisma.competition.update({
        where: { id },
        data: { status: statusDto.status as any },
      });

      this.logger.log(`Competition status changed: ${updated.title} -> ${statusDto.status}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update competition status', error);
      throw new BadRequestException('Failed to update status');
    }
  }

  /**
   * Register for a competition
   * @param id - Competition ID
   * @param registerDto - Registration data
   * @param userId - User ID
   */
  async register(id: string, registerDto: RegisterCompetitionDto, userId: string) {
    const competition = await this.findOne(id);

    // Check if competition is open for registration
    if (competition.status !== 'REGISTRATION_OPEN' && competition.status !== 'DRAFT') {
      throw new BadRequestException('Competition is not open for registration');
    }

    // Check if already registered
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        competitionId: id,
        userId,
      },
    });

    if (existingRegistration) {
      throw new ConflictException('Already registered for this competition');
    }

    // Check max participants
    if (competition.maxParticipants) {
      const registrationCount = await this.prisma.registration.count({
        where: {
          competitionId: id,
          status: 'APPROVED',
        },
      });

      if (registrationCount >= competition.maxParticipants) {
        throw new BadRequestException('Competition is full');
      }
    }

    // Team-based validation
    if (competition.isTeamBased && !registerDto.teamId) {
      throw new BadRequestException('Team ID is required for team-based competitions');
    }

    try {
      const registration = await this.prisma.registration.create({
        data: {
          competitionId: id,
          userId,
          teamId: registerDto.teamId,
          status: competition.requireApproval ? 'PENDING' : 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          team: registerDto.teamId ? {
            select: {
              id: true,
              name: true,
            },
          } : undefined,
        },
      });

      this.logger.log(`User ${userId} registered for competition ${id}`);
      return registration;
    } catch (error) {
      this.logger.error('Failed to register for competition', error);
      throw new BadRequestException('Failed to register for competition');
    }
  }

  /**
   * Unregister from a competition
   * @param id - Competition ID
   * @param userId - User ID
   */
  async unregister(id: string, userId: string) {
    const competition = await this.findOne(id);

    // Check if competition has started
    if (competition.status === 'ACTIVE' || competition.status === 'COMPLETED') {
      throw new BadRequestException('Cannot unregister from active or completed competition');
    }

    const registration = await this.prisma.registration.findFirst({
      where: {
        competitionId: id,
        userId,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    try {
      await this.prisma.registration.delete({
        where: { id: registration.id },
      });

      this.logger.log(`User ${userId} unregistered from competition ${id}`);
      return { message: 'Successfully unregistered from competition' };
    } catch (error) {
      this.logger.error('Failed to unregister from competition', error);
      throw new BadRequestException('Failed to unregister');
    }
  }

  /**
   * Delete a competition (Admin/Owner only)
   * @param id - Competition ID
   * @param userId - User ID
   */
  async remove(id: string, userId: string) {
    const competition = await this.findOne(id);

    // Check ownership or admin rights
    if (competition.adminId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'SUPERADMIN') {
        throw new ForbiddenException('Only the competition owner or SuperAdmin can delete this competition');
      }
    }

    // Prevent deletion if competition has started
    if (competition.status === 'ACTIVE' || competition.status === 'COMPLETED') {
      throw new BadRequestException('Cannot delete active or completed competition');
    }

    try {
      await this.prisma.competition.delete({
        where: { id },
      });

      this.logger.log(`Competition deleted: ${competition.title}`);
      return { message: 'Competition deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete competition', error);
      throw new BadRequestException('Failed to delete competition');
    }
  }

  /**
   * Validate status transitions
   * @param currentStatus - Current status
   * @param newStatus - New status
   */
  private validateStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['REGISTRATION_OPEN', 'CANCELLED'],
      REGISTRATION_OPEN: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
      PAUSED: ['ACTIVE', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
