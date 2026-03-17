// ─── src/common/guards/roles.guard.ts ────────────────────────

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../../auth/auth.types';
import { AUTH_ERROR } from '../../auth/auth.constants';

/**
 * Checks that the authenticated admin has the required role.
 * Only applies when @Roles() decorator is present.
 * Customers are always rejected on role-gated routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — any authenticated user passes
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser;

    // Must be an ADMIN user type
    if (!user || user.type !== 'ADMIN') {
      throw new ForbiddenException(AUTH_ERROR.UNAUTHORIZED);
    }

    if (!user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(AUTH_ERROR.ADMIN_INSUFFICIENT_ROLE);
    }

    return true;
  }
}
