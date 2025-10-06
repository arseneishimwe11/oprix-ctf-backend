import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ClerkSyncService } from './services/clerk-sync.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminGuard } from './guards/admin.guard';
import { SuperAdminGuard } from './guards/superadmin.guard';

/**
 * Auth Module
 * Provides authentication and authorization for the application
 * Integrates with Clerk for user management
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('CLERK_SECRET_KEY'),
        signOptions: {
          expiresIn: '24h', // Token expiration
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ClerkSyncService,
    JwtAuthGuard,
    RolesGuard,
    AdminGuard,
    SuperAdminGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    AdminGuard,
    SuperAdminGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
