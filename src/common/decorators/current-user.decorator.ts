// ─── src/common/decorators/current-user.decorator.ts ─────────

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../../auth/auth.types';

/**
 * Extracts the authenticated user from the request object.
 *
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentUser() user: RequestUser) { ... }
 *
 *   @Get('me')
 *   getMe(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user) return null;
    return field ? user[field] : user;
  },
);
