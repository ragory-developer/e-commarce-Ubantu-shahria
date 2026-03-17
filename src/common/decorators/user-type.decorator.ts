// ─── src/common/decorators/user-type.decorator.ts ────────────

import { SetMetadata } from '@nestjs/common';
import { AuthUserType } from '@prisma/client';

export const USER_TYPE_KEY = 'userType';

/**
 * Restricts a route to a specific user type.
 *
 * Usage:
 *   @UserType('ADMIN')    // only admins can access
 *   @UserType('CUSTOMER') // only customers can access
 *
 * Without this decorator, both admins and customers can access the route
 * (as long as they have a valid JWT).
 */
export const UserType = (...types: AuthUserType[]) =>
  SetMetadata(USER_TYPE_KEY, types);
