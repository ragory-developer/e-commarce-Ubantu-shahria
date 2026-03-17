// ─── src/common/guards/permissions.guard.ts ──────────────────

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermission } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../../auth/auth.types';
import { AUTH_ERROR } from '../../auth/auth.constants';

/**
 * Checks that the authenticated admin has ALL required permissions.
 * Only applies when @Permissions() decorator is present.
 * SUPERADMIN bypasses all permission checks.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<
      AdminPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No @Permissions() decorator — pass through
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser;

    if (!user || user.type !== 'ADMIN') {
      throw new ForbiddenException(AUTH_ERROR.UNAUTHORIZED);
    }

    // SUPERADMIN always has all permissions
    if (user.role === 'SUPERADMIN') return true;

    const userPermissions = user.permissions ?? [];
    const hasAll = requiredPermissions.every((p) =>
      userPermissions.includes(p),
    );

    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
