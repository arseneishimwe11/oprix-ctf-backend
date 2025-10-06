import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { ClerkSyncService } from './services/clerk-sync.service';
import * as bcrypt from 'bcrypt';

/**
 * Auth Service
 * Handles authentication logic with Clerk integration
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private clerkSyncService: ClerkSyncService,
  ) {}

  /**
   * Authenticate user with Clerk
   * Creates or updates local user record
   * @param clerkId - Clerk user ID
   */
  async authenticateWithClerk(clerkId: string) {
    try {
      const user = await this.clerkSyncService.getOrCreateUser(clerkId);
      
      if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      this.logger.log(`User authenticated: ${user.email}`);
      return this.sanitizeUser(user);
    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Get current user profile
   * @param userId - User ID
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    return this.sanitizeUser(user);
  }

  /**
   * NOTE: Session verification removed - we now verify JWTs locally via JwtStrategy
   * No need to call Clerk API for session verification (performance improvement)
   */

  /**
   * Handle Clerk webhook events
   * Syncs user data when events occur in Clerk
   * @param event - Clerk webhook event
   */
  async handleClerkWebhook(event: any) {
    try {
      const eventType = event.type;

      switch (eventType) {
        case 'user.created':
          await this.handleUserCreated(event.data);
          break;
        case 'user.updated':
          await this.handleUserUpdated(event.data);
          break;
        case 'user.deleted':
          await this.handleUserDeleted(event.data);
          break;
        default:
          this.logger.warn(`Unhandled webhook event: ${eventType}`);
      }
    } catch (error) {
      this.logger.error('Webhook handling failed', error);
      throw error;
    }
  }

  /**
   * Handle user created event from Clerk
   */
  private async handleUserCreated(clerkUser: any) {
    const primaryEmail = clerkUser.email_addresses.find(
      (email: any) => email.id === clerkUser.primary_email_address_id,
    );

    if (!primaryEmail) {
      throw new Error('No email address found');
    }

    const username =
      clerkUser.username ||
      primaryEmail.email_address.split('@')[0] ||
      `user_${clerkUser.id.substring(0, 8)}`;

    await this.prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email: primaryEmail.email_address,
        username,
        role: 'USER',
        isActive: true,
        profile: {
          create: {
            firstName: clerkUser.first_name || '',
            lastName: clerkUser.last_name || '',
            avatarUrl: clerkUser.image_url || '',
          },
        },
      },
    });

    this.logger.log(`User created via webhook: ${primaryEmail.email_address}`);
  }

  /**
   * Handle user updated event from Clerk
   */
  private async handleUserUpdated(clerkUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    });

    if (!user) {
      // User doesn't exist, create it
      await this.handleUserCreated(clerkUser);
      return;
    }

    const primaryEmail = clerkUser.email_addresses.find(
      (email: any) => email.id === clerkUser.primary_email_address_id,
    );

    if (primaryEmail) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: primaryEmail.email_address,
          profile: {
            update: {
              firstName: clerkUser.first_name || '',
              lastName: clerkUser.last_name || '',
              avatarUrl: clerkUser.image_url || '',
            },
          },
        },
      });

      this.logger.log(`User updated via webhook: ${primaryEmail.email_address}`);
    }
  }

  /**
   * Handle user deleted event from Clerk
   * Soft delete - mark as inactive
   */
  private async handleUserDeleted(clerkUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      this.logger.log(`User deactivated via webhook: ${user.email}`);
    }
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
