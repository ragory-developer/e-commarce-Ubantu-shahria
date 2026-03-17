// ─── src/common/guards/jwt-auth.guard.ts ─────────────────────

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTH_ERROR } from '../../auth/auth.constants';

/**
 * Global JWT guard applied to every route.
 *
 * - Routes marked @Public() bypass JWT validation.
 * - All other routes require a valid Bearer token.
 * - On success, `req.user` is populated by JwtStrategy.validate().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  // Override error to use our custom message
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw (
        err ??
        new UnauthorizedException(
          info?.name === 'TokenExpiredError'
            ? 'Access token has expired'
            : AUTH_ERROR.UNAUTHORIZED,
        )
      );
    }
    return user;
  }
}
