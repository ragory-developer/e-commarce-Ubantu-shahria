import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { AdminLoginDto } from './dto';
import { AuthResult, DeviceInfo } from './auth.types';
import { AUTH_CONFIG, AUTH_ERROR } from './auth.constants';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  // ✅ Admin Login (production safe)
  async adminLogin(
    dto: AdminLoginDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    const admin = await this.prisma.admin.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        permissions: true,
        isActive: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    // 🔒 Prevent timing attacks
    const dummyHash =
      '$2b$10$KbQiF2Xk5b9VYy8Ej3Z9UeZ5gVxF5D1ZxJHGtJwQ1xExampleDummyHash';

    const hashToCompare = admin?.password ?? dummyHash;

    const passwordValid = await bcrypt.compare(dto.password, hashToCompare);

    // ❌ Same error for wrong email or wrong password
    if (!admin || !passwordValid) {
      if (admin) {
        await this.incrementLoginAttempts(admin.id);
      }

      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);
    }

    // 🔐 Hard lock check
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_LOCKED);
    }

    if (!admin.isActive) {
      throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);
    }

    // ✅ Reset attempts after successful login
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ipAddress ?? null,
      },
    });

    return this.tokenService.loginAndIssueTokens(
      'ADMIN',
      admin.id,
      deviceInfo,
      admin.role,
      admin.permissions,
    );
  }

  // ✅ Seed Super Admin
  async seedSuperAdmin(): Promise<void> {
    const email = process.env.SUPER_ADMIN_EMAIL;

    if (!email) {
      this.logger.warn(
        'SUPER_ADMIN_EMAIL not set, skipping super admin seeding',
      );
      return;
    }

    const existing = await this.prisma.admin.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      this.logger.log('Super admin already exists, skipping seed');
      return;
    }

    const { AdminPermission } = await import('@prisma/client');

    const hashedPassword = await bcrypt.hash(
      AUTH_CONFIG.SUPER_ADMIN_PASSWORD,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    await this.prisma.admin.create({
      data: {
        firstName: AUTH_CONFIG.SUPER_ADMIN_FIRST_NAME,
        lastName: AUTH_CONFIG.SUPER_ADMIN_LAST_NAME,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'SUPERADMIN',
        permissions: Object.values(AdminPermission),
        isActive: true,
      },
    });

    this.logger.log(`Super admin seeded: ${email}`);
  }

  // ✅ Increment login attempts safely
  private async incrementLoginAttempts(id: string): Promise<void> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) return;

    const newAttempts = (admin.loginAttempts ?? 0) + 1;
    const shouldLock = newAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS;

    await this.prisma.admin.update({
      where: { id },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + AUTH_CONFIG.LOCK_DURATION_MS)
          : null,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `Admin ${id} locked due to too many failed login attempts`,
      );
    }
  }
}
