import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/database/prisma.service';
import { User } from '@prisma/client';

/**
 * JWT Strategy for Clerk authentication
 * Verifies JWT locally using Clerk's public keys (JWKS)
 * NO API calls to Clerk on every request - validates signature locally
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const clerkFrontendApi = configService.get<string>('CLERK_FRONTEND_API');
    const clerkAudience = configService.get<string>('CLERK_AUDIENCE');
    
    if (!clerkFrontendApi) {
      throw new Error('CLERK_FRONTEND_API is required');
    }
    
    // Build JWT options - only include audience if it's configured
    const jwtOptions: any = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      
      // Local JWT verification using Clerk's public keys
      // Fetches keys from JWKS endpoint and caches them (NO API call per request)
      secretOrKeyProvider: passportJwtSecret({
        cache: true,          // Cache keys for performance
        rateLimit: true,      // Rate limit JWKS endpoint requests
        jwksRequestsPerMinute: 5,
        jwksUri: `${clerkFrontendApi}/.well-known/jwks.json`,
      }),
      
      // Validate issuer
      issuer: clerkFrontendApi,
      
      // Algorithm used by Clerk
      algorithms: ['RS256'],
    };
    
    // Only validate audience if it's configured
    if (clerkAudience) {
      jwtOptions.audience = clerkAudience;
    }
    
    super(jwtOptions);
    
    this.logger.log('JWT Strategy initialized with local verification (JWKS)');
  }

  /**
   * Validates decoded JWT payload and returns user
   * Token already verified by passport-jwt locally (NO Clerk API call)
   * This method only runs AFTER successful JWT signature verification
   * @param payload - Decoded and verified JWT payload from Clerk
   */
  async validate(payload: any): Promise<User> {
    try {
      // Extract Clerk user ID from verified JWT payload
      // At this point, JWT signature is already verified locally
      const clerkId = payload.sub;

      if (!clerkId) {
        throw new UnauthorizedException('Invalid token payload: missing sub claim');
      }

      // Find user by Clerk ID (only database query - no API call)
      const user = await this.prisma.user.findUnique({
        where: { clerkId },
        include: {
          profile: true,
        },
      });

      // Check if user exists and is active
      if (!user) {
        this.logger.warn(`User not found for clerkId: ${clerkId}`);
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        this.logger.warn(`Inactive account attempted login: ${user.id}`);
        throw new UnauthorizedException('Account is inactive');
      }

      // Update last login timestamp (non-blocking - fire and forget)
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }).catch(err => {
        this.logger.error('Failed to update lastLoginAt', err);
      });

      this.logger.debug(`User authenticated: ${user.email} (local JWT verification)`);
      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('JWT validation error', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}