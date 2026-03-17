// ─── src/auth/customer-auth.service.ts ───────────────────────
// Responsibility: Customer AUTHENTICATION only.
// Profile management → customer.service.ts

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PhoneOtpService } from '../otp/phone-otp.service';
import { TokenService } from './token.service';
import {
  CustomerCompleteRegistrationDto,
  CustomerPasswordLoginDto,
  CustomerOtpLoginVerifyDto,
  CustomerOtpLoginRequestDto,
  CustomerRequestOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyPhoneRequestDto,
  VerifyPhoneConfirmDto,
} from './dto';
import { DeviceInfo, AuthResult } from './auth.types';
import { AUTH_CONFIG, AUTH_ERROR } from './auth.constants';
import { maskPhone } from '../common/helpers/mask.helper';

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneOtpService: PhoneOtpService,
    private readonly tokenService: TokenService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // REGISTRATION — 3-STEP FLOW
  // ══════════════════════════════════════════════════════════════

  // ─── Step 1: Request OTP ──────────────────────────────────────
  async requestRegistrationOtp(
    dto: CustomerRequestOtpDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedPhone: string; expiresInSeconds: number }> {
    // If already a full account, reject (tell them to login)
    const existing = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, deletedAt: null },
      select: { id: true, isGuest: true },
    });

    if (existing && !existing.isGuest) {
      throw new ConflictException(AUTH_ERROR.CUSTOMER_PHONE_TAKEN);
    }

    const result = await this.phoneOtpService.sendOtp({
      target: dto.phone,
      purpose: 'REGISTER_ACCOUNT',
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Failed to send OTP');
    }

    return {
      maskedPhone: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  // ─── Step 2: Verify OTP → registration token ──────────────────
  async verifyRegistrationOtp(
    phone: string,
    code: string,
  ): Promise<{ registrationToken: string; maskedPhone: string }> {
    const otpResult = await this.phoneOtpService.verifyOtp({
      target: phone,
      purpose: 'REGISTER_ACCOUNT',
      code,
      consume: true, // consume so it can't be replayed
    });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    // Issue a short-lived registration token (15 min)
    // This proves the phone was verified without issuing a full auth token
    const registrationToken =
      this.tokenService.generateRegistrationToken(phone);

    return {
      registrationToken,
      maskedPhone: maskPhone(phone),
    };
  }

  // ─── Step 3: Complete Registration ────────────────────────────
  async completeRegistration(
    dto: CustomerCompleteRegistrationDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    // Validate the registration token
    const tokenPayload = this.tokenService.verifyRegistrationToken(
      dto.registrationToken,
    );
    const phone = tokenPayload.sub;

    // Check for conflicts
    const existingPhone = await this.prisma.customer.findFirst({
      where: { phone, isGuest: false, deletedAt: null },
    });
    if (existingPhone)
      throw new ConflictException(AUTH_ERROR.CUSTOMER_PHONE_TAKEN);

    if (dto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { email: dto.email.toLowerCase(), deletedAt: null },
      });
      if (existingEmail)
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    // Check if a guest account with this phone exists (upgrade it)
    const guestAccount = await this.prisma.customer.findFirst({
      where: { phone, isGuest: true, deletedAt: null },
      select: { id: true },
    });

    let customerId: string;

    if (guestAccount) {
      // Upgrade guest → full account (same ID, all orders preserved)
      const updated = await this.prisma.customer.update({
        where: { id: guestAccount.id },
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email?.toLowerCase() ?? null,
          password: hashedPassword,
          isGuest: false,
          phoneVerified: true,
          isActive: true,
        },
        select: { id: true },
      });
      customerId = updated.id;
    } else {
      const created = await this.prisma.customer.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone,
          email: dto.email?.toLowerCase() ?? null,
          password: hashedPassword,
          isGuest: false,
          phoneVerified: true,
          isActive: true,
        },
        select: { id: true },
      });
      customerId = created.id;
    }

    // Save optional address
    if (dto.address) {
      await this.prisma.address.create({
        data: {
          customerId,
          label: dto.address.label ?? 'Home',
          address: dto.address.address,
          descriptions: dto.address.descriptions ?? '',
          city: dto.address.city,
          state: dto.address.state,
          road: dto.address.road ?? '',
          zip: dto.address.zip,
          country: dto.address.country,
          isDefault: true,
          createdBy: customerId,
        },
      });
    }

    this.logger.log(`Customer registered: ${phone}`);

    return this.tokenService.loginAndIssueTokens(
      'CUSTOMER',
      customerId,
      deviceInfo,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════

  // ─── Login with Password ──────────────────────────────────────
  async loginWithPassword(
    dto: CustomerPasswordLoginDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    const customer = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, deletedAt: null },
      select: {
        id: true,
        password: true,
        isActive: true,
        isGuest: true,
        phoneVerified: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!customer)
      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);

    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_LOCKED);
    }

    if (!customer.isActive)
      throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);

    if (customer.isGuest || !customer.password) {
      throw new UnauthorizedException(AUTH_ERROR.CUSTOMER_IS_GUEST);
    }

    const valid = await bcrypt.compare(dto.password, customer.password);
    if (!valid) {
      await this.incrementLoginAttempts(customer.id);
      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ipAddress ?? null,
      },
    });

    return this.tokenService.loginAndIssueTokens(
      'CUSTOMER',
      customer.id,
      deviceInfo,
    );
  }

  // ─── Request OTP login ────────────────────────────────────────
  async requestLoginOtp(
    dto: CustomerOtpLoginRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedPhone: string; expiresInSeconds: number }> {
    const customer = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, isGuest: false, deletedAt: null },
      select: { id: true, isActive: true },
    });

    // Don't reveal if account exists (prevent enumeration)
    if (!customer || !customer.isActive) {
      return { maskedPhone: maskPhone(dto.phone), expiresInSeconds: 300 };
    }

    const result = await this.phoneOtpService.sendOtp({
      target: dto.phone,
      purpose: 'LOGIN_OTP',
      ipAddress,
      userAgent,
    });

    return {
      maskedPhone: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  // ─── Verify OTP and login ─────────────────────────────────────
  async loginWithOtp(
    dto: CustomerOtpLoginVerifyDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    const otpResult = await this.phoneOtpService.verifyOtp({
      target: dto.phone,
      purpose: 'LOGIN_OTP',
      code: dto.code,
      consume: true,
    });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    const customer = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, isGuest: false, deletedAt: null },
      select: { id: true, isActive: true },
    });

    if (!customer || !customer.isActive) {
      throw new UnauthorizedException(AUTH_ERROR.CUSTOMER_NOT_FOUND);
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ipAddress ?? null,
      },
    });

    return this.tokenService.loginAndIssueTokens(
      'CUSTOMER',
      customer.id,
      deviceInfo,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PHONE VERIFICATION (guests + registered)
  // ══════════════════════════════════════════════════════════════

  async requestPhoneVerification(
    dto: VerifyPhoneRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedPhone: string; expiresInSeconds: number }> {
    const result = await this.phoneOtpService.sendOtp({
      target: dto.phone,
      purpose: 'VERIFY_PHONE',
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Failed to send OTP');
    }

    return {
      maskedPhone: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async confirmPhoneVerification(dto: VerifyPhoneConfirmDto): Promise<void> {
    const otpResult = await this.phoneOtpService.verifyOtp({
      target: dto.phone,
      purpose: 'VERIFY_PHONE',
      code: dto.code,
      consume: true,
    });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    // Mark phone as verified for any customer with this phone
    await this.prisma.customer.updateMany({
      where: { phone: dto.phone, deletedAt: null },
      data: { phoneVerified: true },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ══════════════════════════════════════════════════════════════

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedPhone: string; expiresInSeconds: number }> {
    const customer = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, isGuest: false, deletedAt: null },
      select: { id: true },
    });

    // Don't reveal if account doesn't exist
    if (!customer) {
      return { maskedPhone: maskPhone(dto.phone), expiresInSeconds: 300 };
    }

    const result = await this.phoneOtpService.sendOtp({
      target: dto.phone,
      purpose: 'RESET_PASSWORD',
      ipAddress,
      userAgent,
    });

    return {
      maskedPhone: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const otpResult = await this.phoneOtpService.verifyOtp({
      target: dto.phone,
      purpose: 'RESET_PASSWORD',
      code: dto.code,
      consume: true,
    });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    const customer = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, isGuest: false, deletedAt: null },
      select: { id: true },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { password: hashedPassword },
    });

    // Force re-login on all devices
    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customer.id,
      'All_DEVICES',
    );

    this.logger.log(`Password reset for customer: ${dto.phone}`);
  }

  // ─── Private helpers ──────────────────────────────────────────
  private async incrementLoginAttempts(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { loginAttempts: true },
    });
    const newAttempts = (customer?.loginAttempts ?? 0) + 1;
    const shouldLock = newAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS;

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + AUTH_CONFIG.LOCK_DURATION_MS)
          : undefined,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `Customer ${customerId} locked after ${newAttempts} failed attempts`,
      );
    }
  }
}
