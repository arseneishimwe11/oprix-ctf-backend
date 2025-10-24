import * as common from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import { ClerkSyncService } from './services/clerk-sync.service';
import { Request } from 'express';

/**
 * Auth Controller
 * Handles authentication endpoints with Clerk
 */
@ApiTags('auth')
@common.Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private clerkSyncService: ClerkSyncService,
    private configService: ConfigService,
  ) {}

  /**
   * Get current authenticated user
   */
  @common.Get('me')
  @common.UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getCurrentUser(user.id);
  }

  /**
   * Authenticate with Clerk
   * Creates or updates local user from Clerk
   */
  @common.Post('clerk')
  @common.HttpCode(common.HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Clerk' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  async authenticateWithClerk(@common.Body('clerkId') clerkId: string) {
    if (!clerkId) {
      throw new common.UnauthorizedException('Clerk ID is required');
    }

    const user = await this.authService.authenticateWithClerk(clerkId);
    return {
      success: true,
      user,
    };
  }

  /**
   * Clerk webhook endpoint
   * Receives events from Clerk (user created, updated, deleted)
   */
  @common.Post('webhook')
  @common.HttpCode(common.HttpStatus.OK)
  @ApiOperation({ summary: 'Clerk webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook' })
  async handleWebhook(
    @common.Req() req: common.RawBodyRequest<Request>,
  ) {
    // Extract Svix headers for webhook validation
    const headers = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    };

    if (!headers['svix-signature']) {
      throw new common.UnauthorizedException('Missing webhook signature headers');
    }

    // Get raw body for signature verification
    const payload = req.body;

    // Validate webhook signature
    const isValid = await this.clerkSyncService.validateWebhook(
      JSON.stringify(payload),
      headers,
    );

    if (!isValid) {
      throw new common.UnauthorizedException('Invalid webhook signature');
    }

    // Process webhook event
    await this.authService.handleClerkWebhook(payload);

    return { received: true };
  }

  /**
   * Health check for auth service with Clerk configuration status
   */
  @common.Get('health')
  @ApiOperation({ summary: 'Auth service health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  healthCheck() {
    const clerkFrontendApi = this.configService.get<string>('CLERK_FRONTEND_API');
    const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    const clerkPublishableKey = this.configService.get<string>('CLERK_PUBLISHABLE_KEY');
    
    return {
      status: 'ok',
      service: 'auth',
      timestamp: new Date().toISOString(),
      clerk: {
        configured: !!(clerkFrontendApi && clerkSecretKey),
        frontendApi: clerkFrontendApi || 'NOT_SET',
        hasSecretKey: !!clerkSecretKey,
        hasPublishableKey: !!clerkPublishableKey,
      },
    };
  }
}
