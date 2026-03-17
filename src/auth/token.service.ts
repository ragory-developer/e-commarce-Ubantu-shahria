import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import {
  AuthResult,
  DeviceInfo,
  JwtPayload,
  RegistrationTokenPayload,
  TokenPair,
} from './auth.types';
import {
  AUTH_CONFIG,
  AUTH_ERROR,
  REGISTRATION_TOKEN_EXPIRES_IN,
} from './auth.constants';
import { AdminPermission, AdminRole, AuthUserType } from '@prisma/client';

@Injectable()
export class TokenService {
  // Placeholder for token-related logic (e.g., generating, validating tokens)
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly ConfigService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ! Hash a row token using SHA-256 before storing in DB
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ! generate refresh token randomly
  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  // ! Generate JWT access token
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
      secret: this.ConfigService.getOrThrow<string>('jwt.secret'),
    });
  }

  //! ─── Issue short-lived registration token (after OTP verify) ─
  //! This is NOT an auth token — it proves the phone was verified
  //! and is consumed when registration is completed.
  generateRegistrationToken(phone: string): string {
    const payload: RegistrationTokenPayload = {
      sub: phone,
      purpose: 'REGISTRATION',
    };
    return this.jwtService.sign(payload, {
      expiresIn: REGISTRATION_TOKEN_EXPIRES_IN,
      secret: this.ConfigService.getOrThrow<string>('jwt.secret'),
    });
  }

  // ! verify registration token and extract phone number
  verifyRegistrationToken(token: string): RegistrationTokenPayload {
    try {
      const payload = this.jwtService.verify<RegistrationTokenPayload>(token, {
        secret: this.ConfigService.getOrThrow<string>('jwt.secret'),
      });
      if (payload.purpose !== 'REGISTRATION') {
        throw new UnauthorizedException(
          AUTH_ERROR.OTP_REGISTRATION_TOKEN_INVALID,
        );
      }
      return payload;
    } catch {
      throw new UnauthorizedException(
        AUTH_ERROR.OTP_REGISTRATION_TOKEN_INVALID,
      );
    }
  }

  // ! create or reuse a device record
  async upsertDevice(
    userType: AuthUserType,
    ownerId: string,
    deviceInfo: DeviceInfo,
  ): Promise<string> {
    const isAdmin = userType === 'ADMIN';
    const ownerField = isAdmin ? { adminId: ownerId } : { customerId: ownerId };

    const existing = await this.prisma.device.findFirst({
      where: { ...ownerField, deviceId: deviceInfo.clientDeviceId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          revokedAt: null,
          lastActiveAt: new Date(),
          deviceName: deviceInfo.deviceName ?? undefined,
          deviceType: deviceInfo.deviceType ?? undefined,
          userAgent: deviceInfo.userAgent ?? null,
          ipAddress: deviceInfo.ipAddress ?? null,
        },
      });
      return existing.id;
    }
    const device = await this.prisma.device.create({
      data: {
        ...ownerField,
        userType,
        deviceId: deviceInfo.clientDeviceId,
        deviceName: deviceInfo.deviceName ?? null,
        deviceType: deviceInfo.deviceType ?? undefined,
        userAgent: deviceInfo.userAgent ?? null,
        ipAddress: deviceInfo.ipAddress ?? null,
      },
      select: { id: true },
    });
    return device.id;
  }

  // ! access token + refresh token pair
  async issuesTokenPair(
    userType: AuthUserType,
    ownerId: string,
    deviceDbId: string,
    role?: AdminRole,
    permission?: AdminPermission[],
    tokenFamily?: string, // for refresh token rotation
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: ownerId,
      type: userType,
      deviceId: deviceDbId,
      role,
      permissions: permission,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();
    const hashedRefreshToken = this.hashToken(refreshToken);
    const family = tokenFamily ?? crypto.randomUUID();

    const expireAt = new Date(
      Date.now() + AUTH_CONFIG.REFRESH_TOKEN_EXPIRES_MS,
    );

    const ownerField =
      userType === 'ADMIN' ? { adminId: ownerId } : { customerId: ownerId };

    await this.prisma.authToken.create({
      data: {
        userType,
        ...ownerField,
        deviceId: deviceDbId,
        tokenFamily: family,
        tokenHash: hashedRefreshToken,
        expiresAt: expireAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN / 1000, // convert ms to seconds
    };
  }

  // ! full login: upsert device + issue tokens
  async loginAndIssueTokens(
    userType: AuthUserType,
    ownerId: string,
    deviceInfo: DeviceInfo,
    role?: AdminRole,
    permission?: AdminPermission[],
  ): Promise<AuthResult> {
    const deviceDbId = await this.upsertDevice(userType, ownerId, deviceInfo);
    const tokens = await this.issuesTokenPair(
      userType,
      ownerId,
      deviceDbId,
      role,
      permission,
    );
    return { tokens, deviceDbId };
  }

  // ! revoke token family if reuse detected
  private async revokeTokenFamily(
    tokenFamily: string,
    reason: string,
  ): Promise<void> {
    const tokens = await this.prisma.authToken.findMany({
      where: { tokenFamily },
      include: { device: true },
    });
    await this.prisma.authToken.updateMany({
      where: { tokenFamily },
      data: {
        revoked: true,
        revokedReason: reason,
        revokedAt: new Date(),
      },
    });

    const deviceIds = [
      ...new Set(tokens.map((t) => t.deviceId).filter(Boolean)),
    ] as string[];

    if (deviceIds.length > 0) {
      await this.prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { isActive: false, revokedAt: new Date() },
      });
    }
  }

  // ! rotate refresh token: invalidate old, issue new
  async rotateRefreshToken(
    rawRefreshToken: string,
    clientDeviceId?: string,
  ): Promise<{ tokens: TokenPair; UserType: AuthUserType; ownerId: string }> {
    const hashedToken = this.hashToken(rawRefreshToken);

    const tokenRecord = await this.prisma.authToken.findFirst({
      where: { tokenHash: hashedToken },
      include: { device: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(AUTH_ERROR.TOKEN_INVALID);
    }

    // ! reuse detection: if token is valid but device is revoked, it's a reuse attempt
    if (tokenRecord.revoked) {
      this.logger.warn(
        `Refresh token reuse detected! Family: ${tokenRecord.tokenFamily}, Device: ${tokenRecord.deviceId}`,
      );
      await this.revokeTokenFamily(tokenRecord.tokenFamily, 'SECURITY');
      throw new UnauthorizedException(AUTH_ERROR.REFRESH_TOKEN_REUSE);
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.authToken.update({
        where: { id: tokenRecord.id },
        data: {
          revoked: true,
          revokedAt: new Date(),
          revokedReason: 'EXPIRED',
        },
      });
      throw new UnauthorizedException(AUTH_ERROR.TOKEN_INVALID);
    }

    if (!tokenRecord.device || !tokenRecord.device.isActive) {
      throw new UnauthorizedException(AUTH_ERROR.TOKEN_REVOKED);
    }

    const { userType, adminId, customerId, tokenFamily, deviceId } =
      tokenRecord;
    const ownerId = (adminId ?? customerId)!;

    if (!deviceId) throw new UnauthorizedException(AUTH_ERROR.TOKEN_INVALID);

    if (userType === 'ADMIN') {
      const admin = await this.prisma.admin.findFirst({
        where: { id: ownerId, isActive: true, deletedAt: null },
        select: { id: true, role: true, permissions: true },
      });
      if (!admin) throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);

      await this.prisma.authToken.update({
        where: { id: tokenRecord.id },
        data: {
          revoked: true,
          revokedAt: new Date(),
          revokedReason: 'ROTATED',
        },
      });

      const tokens = await this.issuesTokenPair(
        userType,
        ownerId,
        deviceId,
        admin.role,
        admin.permissions,
        tokenFamily,
      );
      return { tokens, UserType: userType, ownerId };
    } else {
      const customer = await this.prisma.customer.findFirst({
        where: { id: ownerId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!customer)
        throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);

      await this.prisma.authToken.update({
        where: { id: tokenRecord.id },
        data: {
          revoked: true,
          revokedAt: new Date(),
          revokedReason: 'ROTATED',
        },
      });

      const tokens = await this.issuesTokenPair(
        userType,
        ownerId,
        deviceId,
        undefined,
        undefined,
        tokenFamily,
      );
      return { tokens, UserType: userType, ownerId };
    }
  }

  async revokeToken(rawRefreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(rawRefreshToken);
    await this.prisma.authToken.updateMany({
      where: { tokenHash: hashedToken, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: 'LOGOUT',
      },
    });
  }

  async revokeDeviceTokens(
    deviceDbId: string,
    reason = 'LOGOUT',
  ): Promise<void> {
    await this.prisma.authToken.updateMany({
      where: { id: deviceDbId },
      data: { revoked: true, revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllOwnerTokens(
    userType: AuthUserType,
    ownerId: string,
    reason: 'All_DEVICES',
  ): Promise<void> {
    const ownerWhere =
      userType === 'ADMIN' ? { adminId: ownerId } : { customerId: ownerId };

    await this.prisma.authToken.updateMany({
      where: { ...ownerWhere, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    await this.prisma.device.updateMany({
      where: { ...ownerWhere, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.authToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            revoked: true,
            revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    });
    this.logger.log(`Cleaned up ${result.count} expired auth tokens`);
    return result.count;
  }
}
