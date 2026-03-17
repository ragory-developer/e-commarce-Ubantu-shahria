// ─── src/common/guards/user-type.guard.ts ────────────────────

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUserType } from '@prisma/client';
import { USER_TYPE_KEY } from '../decorators/user-type.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../../auth/auth.types';
import { AUTH_ERROR } from '../../auth/auth.constants';

/**
 * Restricts routes to specific user types.
 * Used when a route should only be accessible by ADMIN or CUSTOMER,
 * but not both.
 *
 * Usage:
 *   @UserType('CUSTOMER')  — only customers
 *   @UserType('ADMIN')     — only admins (use @Roles for role-specific)
 */
@Injectable()
export class UserTypeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowedTypes = this.reflector.getAllAndOverride<AuthUserType[]>(
      USER_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @UserType() decorator — any authenticated user passes
    if (!allowedTypes || allowedTypes.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser;

    if (!user || !allowedTypes.includes(user.type)) {
      throw new ForbiddenException(AUTH_ERROR.UNAUTHORIZED);
    }

    return true;
  }
}
