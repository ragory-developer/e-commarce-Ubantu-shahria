// ─── src/auth/strategies/jwt.strategy.ts ─────────────────────

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, RequestUser } from '../auth.types';
import { AUTH_ERROR } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Extract Bearer token from Authorization header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Reject expired tokens (don't let them through for refresh logic)
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  // Called after JWT signature is verified and token is not expired.
  // Return value is attached to req.user.
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const { sub, type, deviceId, role, permissions } = payload;

    // Verify the device is still active (not revoked/logged out)
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!device) {
      throw new UnauthorizedException(AUTH_ERROR.TOKEN_REVOKED);
    }

    // Verify the owner account is still active
    if (type === 'ADMIN') {
      const admin = await this.prisma.admin.findFirst({
        where: { id: sub, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!admin) {
        throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);
      }
    } else {
      const customer = await this.prisma.customer.findFirst({
        where: { id: sub, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!customer) {
        throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);
      }
    }

    // Update device last active (fire-and-forget, don't await)
    this.prisma.device
      .update({
        where: { id: deviceId },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {
        // Non-critical, ignore error
      });

    return {
      id: sub,
      type,
      deviceId,
      role,
      permissions,
    };
  }
}
