import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';

/**
 * SuperAdmin Service (SaaS Platform Owner)
 * 
 * ROLE: Platform administrator - does NOT interact with players
 * RESPONSIBILITIES:
 * - Create/manage Admin accounts (CTF organizers)
 * - Monitor platform-wide health and statistics
 * - View system audit logs
 * - Manage platform settings
 */
@Injectable()
export class SuperadminService {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
  ) {}

  /**
   * Create new Admin account (CTF hoster)
   * SuperAdmin creates admin with credentials
   */
  async createAdmin(data: {
    username: string;
    email: string;
    password: string;
    organizationName?: string;
  }, superadminId: string) {
    // Check if email already exists
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Username or email already exists');
    }

    // Hash password
    const passwordHash = await this.cryptoService.hashPassword(data.password);

    // Create admin account
    const admin = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        clerkId: `admin_${Date.now()}`, // Placeholder for non-Clerk admins
      },
    });

    this.logger.log(`SuperAdmin ${superadminId} created Admin account: ${admin.username} (${admin.email})`);

    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
      credentials: {
        username: data.username,
        temporaryPassword: data.password, // Return once, admin should change it
      },
    };
  }

  /**
   * Get all Admin accounts (CTF organizers)
   */
  async getAllAdmins(page = 1, limit = 20) {
    const where = { role: 'ADMIN' as const };

    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              adminCompetitions: true, // Competitions they manage
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      admins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Suspend/Activate Admin account
   */
  async toggleAdminStatus(adminId: string, superadminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.role !== 'ADMIN') {
      throw new ForbiddenException('User is not an admin');
    }

    const updated = await this.prisma.user.update({
      where: { id: adminId },
      data: { isActive: !admin.isActive },
    });

    this.logger.log(`SuperAdmin ${superadminId} ${updated.isActive ? 'activated' : 'suspended'} admin ${adminId}`);
    return updated;
  }

  /**
   * Delete Admin account
   */
  async deleteAdmin(adminId: string, superadminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.role !== 'ADMIN') {
      throw new ForbiddenException('User is not an admin');
    }

    // Check if admin has active competitions
    const activeComps = await this.prisma.competition.count({
      where: {
        adminId: adminId,
        status: { in: ['REGISTRATION_OPEN', 'ACTIVE'] },
      },
    });

    if (activeComps > 0) {
      throw new ForbiddenException('Cannot delete admin with active competitions');
    }

    await this.prisma.user.delete({ where: { id: adminId } });
    
    this.logger.warn(`SuperAdmin ${superadminId} deleted admin ${adminId} (${admin.username})`);
    return { success: true, message: 'Admin account deleted successfully' };
  }

  /**
   * Get platform-wide statistics (high-level overview)
   */
  async getPlatformStats() {
    const [
      totalAdmins,
      activeAdmins,
      totalPlayers,
      activePlayers,
      totalCompetitions,
      activeCompetitions,
      totalSubmissions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } }),
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'USER', isActive: true } }),
      this.prisma.competition.count(),
      this.prisma.competition.count({ where: { status: 'ACTIVE' } }),
      this.prisma.submission.count(),
    ]);

    return {
      admins: {
        total: totalAdmins,
        active: activeAdmins,
        suspended: totalAdmins - activeAdmins,
      },
      players: {
        total: totalPlayers,
        active: activePlayers,
      },
      competitions: {
        total: totalCompetitions,
        active: activeCompetitions,
      },
      submissions: {
        total: totalSubmissions,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get system audit logs
   */
  async getAuditLogs(filters?: { userId?: string; action?: string; page?: number; limit?: number }) {
    const { userId, action, page = 1, limit = 100 } = filters || {};

    const where = {
      ...(userId && { userId }),
      ...(action && { action }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              username: true,
              email: true,
              role: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update SuperAdmin's own profile (for production handover)
   */
  async updateMyProfile(superadminId: string, data: {
    currentPassword: string;
    newPassword?: string;
    email?: string;
    username?: string;
  }) {
    // Get current SuperAdmin
    const superAdmin = await this.prisma.user.findUnique({
      where: { id: superadminId, role: 'SUPERADMIN' },
    });

    if (!superAdmin) {
      throw new NotFoundException('SuperAdmin not found');
    }

    // Verify current password
    if (!superAdmin.passwordHash) {
      throw new ForbiddenException('Account has no password set');
    }

    const isCurrentPasswordValid = await this.cryptoService.comparePassword(
      data.currentPassword,
      superAdmin.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new ForbiddenException('Current password is incorrect');
    }

    // Check for email/username conflicts (if changing)
    if (data.email || data.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: superadminId } },
            {
              OR: [
                ...(data.email ? [{ email: data.email }] : []),
                ...(data.username ? [{ username: data.username }] : []),
              ],
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException('Email or username already taken');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.username) updateData.username = data.username;
    if (data.newPassword) {
      updateData.passwordHash = await this.cryptoService.hashPassword(data.newPassword);
    }

    // Update SuperAdmin
    const updatedSuperAdmin = await this.prisma.user.update({
      where: { id: superadminId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        updatedAt: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: superadminId,
        action: 'PROFILE_UPDATE',
        entityType: 'User',
        entityId: superadminId,
        details: {
          message: 'SuperAdmin updated their profile',
          changes: Object.keys(updateData),
        },
      },
    });

    this.logger.log(`SuperAdmin ${superadminId} updated their profile`);
    return updatedSuperAdmin;
  }

  /**
   * Get SuperAdmin's own profile
   */
  async getMyProfile(superadminId: string) {
    const superAdmin = await this.prisma.user.findUnique({
      where: { id: superadminId, role: 'SUPERADMIN' },
      select: {
        id: true,
        email: true,
        username: true,
        clerkId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!superAdmin) {
      throw new NotFoundException('SuperAdmin not found');
    }

    return superAdmin;
  }

  /**
   * Initialize SuperAdmin for production handover
   * This creates a one-time setup token for the real SuperAdmin
   */
  async createHandoverToken(superadminId: string) {
    const superAdmin = await this.prisma.user.findUnique({
      where: { id: superadminId, role: 'SUPERADMIN' },
    });

    if (!superAdmin) {
      throw new NotFoundException('SuperAdmin not found');
    }

    // Generate one-time setup token (valid for 24 hours)
    const setupToken = this.cryptoService.generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store setup token in database (you might want to create a separate table for this)
    await this.prisma.user.update({
      where: { id: superadminId },
      data: {
        // Store token in a custom field or create a separate tokens table
        clerkId: `setup_${setupToken}_${expiresAt.getTime()}`,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: superadminId,
        action: 'HANDOVER_TOKEN_CREATED',
        entityType: 'User',
        entityId: superadminId,
        details: {
          message: 'One-time setup token created for production handover',
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    this.logger.warn(`Handover token created for SuperAdmin ${superadminId}`);

    return {
      setupToken,
      expiresAt,
      setupUrl: `/setup?token=${setupToken}`,
      message: 'Share this token with the production SuperAdmin. It expires in 24 hours.',
    };
  }

  /**
   * Get admin activity report
   */
  async getAdminActivity(adminId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const [competitions, totalPlayers, totalSubmissions] = await Promise.all([
      this.prisma.competition.findMany({
        where: { adminId: adminId },
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
      }),
      this.prisma.registration.count({
        where: { competition: { adminId: adminId } },
      }),
      this.prisma.submission.count({
        where: { 
          challenge: { 
            competition: { adminId: adminId } 
          } 
        },
      }),
    ]);

    return {
      admin,
      activity: {
        totalCompetitions: competitions.length,
        competitions,
        totalPlayers,
        totalSubmissions,
      },
    };
  }
}
