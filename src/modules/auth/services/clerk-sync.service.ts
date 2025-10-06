import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../common/database/prisma.service';

/**
 * Clerk Sync Service
 * USAGE: ONLY for webhooks and user synchronization
 * 
 * This service handles:
 * - Webhook signature verification
 * - User creation/updates from Clerk webhooks
 * - Admin operations requiring Clerk API
 */
@Injectable()
export class ClerkSyncService {
  private readonly logger = new Logger(ClerkSyncService.name);
  private readonly clerk: ClerkClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }
    this.clerk = createClerkClient({ secretKey });
  }


  /**
   * Get or create user from Clerk
   * Syncs Clerk user data with local database
   * @param clerkId - Clerk user ID
   */
  async getOrCreateUser(clerkId: string) {
    try {
      // Get user from Clerk
      const clerkUser = await this.clerk.users.getUser(clerkId);

      // Check if user exists in database
      let user = await this.prisma.user.findUnique({
        where: { clerkId },
        include: { profile: true },
      });

      // Create user if doesn't exist
      if (!user) {
        const primaryEmail = clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        );

        if (!primaryEmail) {
          throw new UnauthorizedException('No email address found');
        }

        // Extract username from email or use Clerk username
        const username =
          clerkUser.username ||
          primaryEmail.emailAddress.split('@')[0] ||
          `user_${clerkId.substring(0, 8)}`;

        user = await this.prisma.user.create({
          data: {
            clerkId,
            email: primaryEmail.emailAddress,
            username,
            role: 'USER', // Default role
            isActive: true,
            profile: {
              create: {
                firstName: clerkUser.firstName || '',
                lastName: clerkUser.lastName || '',
                avatarUrl: clerkUser.imageUrl || '',
              },
            },
          },
          include: { profile: true },
        });

        this.logger.log(`New user created from Clerk: ${user.email}`);
      } else {
        // Update user information if changed
        const primaryEmail = clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        );

        if (primaryEmail && primaryEmail.emailAddress !== user.email) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              email: primaryEmail.emailAddress,
              lastLoginAt: new Date(),
            },
            include: { profile: true },
          });
        }
      }

      return user;
    } catch (error) {
      this.logger.error(`Failed to get/create user for ${clerkId}`, error);
      throw new UnauthorizedException('Failed to authenticate user');
    }
  }

  /**
   * Validate Clerk webhook signature using Svix
   * SECURITY: Proper webhook validation to prevent unauthorized calls
   * @param payload - Webhook payload (raw body string)
   * @param headers - Request headers containing svix signature
   */
  async validateWebhook(payload: string, headers: Record<string, string>): Promise<boolean> {
    const webhookSecret = this.configService.get<string>('CLERK_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('CLERK_WEBHOOK_SECRET not configured - webhooks will fail');
      return false;
    }

    try {
      // Extract Svix headers
      const svix_id = headers['svix-id'];
      const svix_timestamp = headers['svix-timestamp'];
      const svix_signature = headers['svix-signature'];

      if (!svix_id || !svix_timestamp || !svix_signature) {
        this.logger.warn('Missing Svix webhook headers');
        return false;
      }

      // Verify webhook using Clerk's method
      // Note: Install @clerk/clerk-sdk-node if not already installed
      const crypto = require('crypto');
      const signedContent = `${svix_id}.${svix_timestamp}.${payload}`;
      const secret = webhookSecret.split('_')[1]; // Remove 'whsec_' prefix
      const secretBytes = Buffer.from(secret, 'base64');
      
      const signature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64');

      const expectedSignature = `v1,${signature}`;
      
      // Constant-time comparison to prevent timing attacks
      const signatures = svix_signature.split(' ');
      for (const versionedSignature of signatures) {
        const [version, sig] = versionedSignature.split(',');
        if (version === 'v1') {
          if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature))) {
            return true;
          }
        }
      }

      this.logger.warn('Webhook signature validation failed');
      return false;
    } catch (error) {
      this.logger.error('Webhook validation error', error);
      return false;
    }
  }
}