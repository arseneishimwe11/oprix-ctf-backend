import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * SuperAdmin Guard
 * Restricts access to SuperAdmin role only
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only SUPERADMIN can access
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('SuperAdmin access required');
    }

    return true;
  }
}