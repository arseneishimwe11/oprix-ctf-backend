import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Admin Guard
 * Shortcut guard for Admin and SuperAdmin access
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Allow ADMIN and SUPERADMIN roles
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}