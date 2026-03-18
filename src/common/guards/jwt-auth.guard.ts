// src/common/guards/jwt-auth.guard.ts
// UPDATED: Supports @OptionalAuth() decorator — checkout endpoints work for both
// authenticated customers AND anonymous guests

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // @Public() — skip auth entirely
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // @OptionalAuth() — try to authenticate but don't fail if no token
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isOptional) {
      return this.handleOptionalAuth(context);
    }

    // Default — require valid JWT
    return super.canActivate(context);
  }

  private async handleOptionalAuth(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token — allow but req.user will be undefined
      request.user = null;
      return true;
    }

    try {
      // Try to authenticate with the provided token
      const result = await (super.canActivate(context) as Promise<boolean>);
      return result;
    } catch {
      // Token present but invalid — still allow (guest mode)
      request.user = null;
      return true;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Check if this is an optional-auth route
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isOptional) {
      // For optional auth, return null user instead of throwing
      return user ?? null;
    }

    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
