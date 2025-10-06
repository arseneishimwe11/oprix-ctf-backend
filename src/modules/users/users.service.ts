import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateUserDto, UpdateProfileDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserRoleDto, ListUsersQueryDto } from './dto/update-user.dto';

/**
 * Users Service
 * Handles all user-related operations
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new user (SuperAdmin only)
   * Typically users are created via Clerk webhooks
   * @param createUserDto - User creation data
   */
  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { clerkId: createUserDto.clerkId },
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this clerkId, email, or username already exists');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          clerkId: createUserDto.clerkId,
          username: createUserDto.username,
          email: createUserDto.email,
          role: createUserDto.role || 'USER',
          isActive: true,
          profile: {
            create: {},
          },
        },
        include: {
          profile: true,
        },
      });

      this.logger.log(`User created: ${user.email}`);
      return this.sanitizeUser(user);
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw new BadRequestException('Failed to create user');
    }
  }

  /**
   * Get all users with pagination and filtering
   * @param query - Query parameters for filtering
   */
  async findAll(query: ListUsersQueryDto) {
    const { page = 1, limit = 20, role, search, isActive } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.sanitizeUser(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single user by ID
   * @param id - User ID
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        teams: {
          include: {
            team: true,
          },
        },
        scores: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Get user by Clerk ID
   * @param clerkId - Clerk user ID
   */
  async findByClerkId(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with Clerk ID ${clerkId} not found`);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Update user details (admin only)
   * @param id - User ID
   * @param updateUserDto - Update data
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    // Check for username conflicts
    if (updateUserDto.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          username: updateUserDto.username,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
        include: {
          profile: true,
        },
      });

      this.logger.log(`User updated: ${updated.email}`);
      return this.sanitizeUser(updated);
    } catch (error) {
      this.logger.error('Failed to update user', error);
      throw new BadRequestException('Failed to update user');
    }
  }

  /**
   * Update user profile (user can update their own)
   * @param userId - User ID
   * @param updateProfileDto - Profile update data
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.findOne(userId);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          profile: {
            update: updateProfileDto,
          },
        },
        include: {
          profile: true,
        },
      });

      this.logger.log(`Profile updated for user: ${updated.email}`);
      return this.sanitizeUser(updated);
    } catch (error) {
      this.logger.error('Failed to update profile', error);
      throw new BadRequestException('Failed to update profile');
    }
  }

  /**
   * Update user role (SuperAdmin only)
   * @param id - User ID
   * @param updateRoleDto - Role update data
   * @param adminId - ID of admin performing the action
   */
  async updateRole(id: string, updateRoleDto: UpdateUserRoleDto, adminId: string) {
    const user = await this.findOne(id);
    const admin = await this.findOne(adminId);

    // Prevent demoting other SuperAdmins
    if (user.role === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Cannot modify SuperAdmin role');
    }

    // Prevent users from changing their own role
    if (id === adminId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: { role: updateRoleDto.role },
        include: {
          profile: true,
        },
      });

      this.logger.log(`User role updated: ${updated.email} -> ${updateRoleDto.role}`);
      return this.sanitizeUser(updated);
    } catch (error) {
      this.logger.error('Failed to update role', error);
      throw new BadRequestException('Failed to update role');
    }
  }

  /**
   * Soft delete user (mark as inactive)
   * @param id - User ID
   */
  async remove(id: string) {
    const user = await this.findOne(id);

    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('Cannot delete SuperAdmin accounts');
    }

    try {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`User deactivated: ${user.email}`);
      return { message: 'User deactivated successfully' };
    } catch (error) {
      this.logger.error('Failed to deactivate user', error);
      throw new BadRequestException('Failed to deactivate user');
    }
  }

  /**
   * Get user statistics
   * @param userId - User ID
   */
  async getUserStats(userId: string) {
    const user = await this.findOne(userId);

    const [totalScores, totalSubmissions, solvedChallenges, competitions] = await Promise.all([
      this.prisma.score.aggregate({
        where: { userId },
        _sum: { points: true },
        _count: true,
      }),
      this.prisma.submission.count({
        where: { userId },
      }),
      this.prisma.submission.count({
        where: { userId, isCorrect: true },
      }),
      this.prisma.registration.count({
        where: { userId, status: 'APPROVED' },
      }),
    ]);

    return {
      user: this.sanitizeUser(user),
      stats: {
        totalPoints: totalScores._sum.points || 0,
        totalSubmissions,
        solvedChallenges,
        participatedCompetitions: competitions,
      },
    };
  }

  /**
   * Remove sensitive data from user object
   * @param user - User object
   */
  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
