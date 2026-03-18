// ─── src/auth/customer-auth.service.ts ───────────────────────
// Enhanced customer authentication with email + phone support

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
import { EmailOtpService } from '../otp/email-otp.service';
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
  VerifyEmailRequestDto,
  VerifyEmailConfirmDto,
  LinkEmailRequestDto,
  LinkEmailVerifyDto,
  LinkPhoneRequestDto,
  LinkPhoneVerifyDto,
  ChangePasswordDto,
} from './dto';
import { DeviceInfo, AuthResult } from './auth.types';
import { AUTH_CONFIG, AUTH_ERROR, AUTH_MESSAGES } from './auth.constants';
import { maskPhone } from '../common/helpers/mask.helper';
import { maskEmail } from '../common/helpers/mask.helper';

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneOtpService: PhoneOtpService,
    private readonly emailOtpService: EmailOtpService,
    private readonly tokenService: TokenService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // REGISTRATION — 3-STEP FLOW (Phone or Email)
  // ══════════════════════════════════════════════════════════════

  /**
   * Step 1: Request OTP for registration
   * Supports both phone and email registration
   */
  async requestRegistrationOtp(
    dto: CustomerRequestOtpDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedTarget: string; expiresInSeconds: number }> {
    const target = dto.type === 'phone' ? dto.value : dto.value.toLowerCase();

    // Check if already registered (not a guest)
    const whereClause =
      dto.type === 'phone'
        ? { phone: target, deletedAt: null }
        : { email: target, deletedAt: null };

    const existing = await this.prisma.customer.findFirst({
      where: whereClause,
      select: { id: true, isGuest: true },
    });

    if (existing && !existing.isGuest) {
      const errorMessage =
        dto.type === 'phone'
          ? AUTH_ERROR.CUSTOMER_PHONE_TAKEN
          : AUTH_ERROR.CUSTOMER_EMAIL_TAKEN;
      throw new ConflictException(errorMessage);
    }

    // Send OTP via appropriate channel
    const result =
      dto.type === 'phone'
        ? await this.phoneOtpService.sendOtp({
            target,
            purpose: 'REGISTER_ACCOUNT',
            ipAddress,
            userAgent,
          })
        : await this.emailOtpService.sendOtp({
            target,
            purpose: 'REGISTER_ACCOUNT',
            ipAddress,
            userAgent,
          });

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Failed to send OTP');
    }

    return {
      maskedTarget: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  /**
   * Step 2: Verify OTP → issue registration token
   */
  async verifyRegistrationOtp(
    type: 'phone' | 'email',
    value: string,
    code: string,
  ): Promise<{ registrationToken: string; maskedTarget: string }> {
    const target = type === 'phone' ? value : value.toLowerCase();

    const otpResult =
      type === 'phone'
        ? await this.phoneOtpService.verifyOtp({
            target,
            purpose: 'REGISTER_ACCOUNT',
            code,
            consume: true,
          })
        : await this.emailOtpService.verifyOtp({
            target,
            purpose: 'REGISTER_ACCOUNT',
            code,
            consume: true,
          });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    // Issue registration token
    const registrationToken =
      this.tokenService.generateRegistrationToken(target);

    const maskedTarget =
      type === 'phone' ? maskPhone(target) : maskEmail(target);

    return { registrationToken, maskedTarget };
  }

  /**
   * Step 3: Complete registration
   */
  async completeRegistration(
    dto: CustomerCompleteRegistrationDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    // Verify registration token
    const tokenPayload = this.tokenService.verifyRegistrationToken(
      dto.registrationToken,
    );
    const verifiedValue = tokenPayload.sub;

    // Determine if it's phone or email
    const isEmail = verifiedValue.includes('@');
    const isPhone = !isEmail;

    // Check for conflicts
    if (isPhone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: { phone: verifiedValue, isGuest: false, deletedAt: null },
      });
      if (existingPhone) {
        throw new ConflictException(AUTH_ERROR.CUSTOMER_PHONE_TAKEN);
      }
    } else {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { email: verifiedValue, isGuest: false, deletedAt: null },
      });
      if (existingEmail) {
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
      }
    }

    // Check if optional email is provided (for phone registration)
    if (dto.email && isPhone) {
      const emailTaken = await this.prisma.customer.findFirst({
        where: { email: dto.email.toLowerCase(), deletedAt: null },
      });
      if (emailTaken) {
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
      }
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    // Check if guest account exists (upgrade it)
    const whereClause = isPhone
      ? { phone: verifiedValue, isGuest: true, deletedAt: null }
      : { email: verifiedValue, isGuest: true, deletedAt: null };

    const guestAccount = await this.prisma.customer.findFirst({
      where: whereClause,
      select: { id: true },
    });

    let customerId: string;

    if (guestAccount) {
      // Upgrade guest to full account
      const updated = await this.prisma.customer.update({
        where: { id: guestAccount.id },
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: isEmail ? verifiedValue : (dto.email?.toLowerCase() ?? null),
          phone: isPhone ? verifiedValue : undefined,
          password: hashedPassword,
          isGuest: false,
          phoneVerified: isPhone,
          emailVerified: isEmail,
          isActive: true,
        },
        select: { id: true },
      });
      customerId = updated.id;
    } else {
      // Create new account
      const created = await this.prisma.customer.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone ?? undefined,
          email: dto.email ?? undefined,
          password: hashedPassword,
          isGuest: false,
          phoneVerified: isPhone,
          emailVerified: isEmail,
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
          ...(dto.address.city && {
            city: { connect: { id: dto.address.city } },
          }),
          state: dto.address.state,
          road: dto.address.road ?? '',
          zip: dto.address.zip,
          country: dto.address.country,
          isDefault: true,
          createdBy: customerId,
        },
      });
    }

    this.logger.log(`Customer registered: ${verifiedValue}`);

    return this.tokenService.loginAndIssueTokens(
      'CUSTOMER',
      customerId,
      deviceInfo,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════

  /**
   * Login with password (phone or email)
   */
  async loginWithPassword(
    dto: CustomerPasswordLoginDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    const isEmail = dto.identifier.includes('@');
    const identifier = isEmail ? dto.identifier.toLowerCase() : dto.identifier;

    const whereClause = isEmail
      ? { email: identifier, deletedAt: null }
      : { phone: identifier, deletedAt: null };

    const customer = await this.prisma.customer.findFirst({
      where: whereClause,
      select: {
        id: true,
        password: true,
        isActive: true,
        isGuest: true,
        phoneVerified: true,
        emailVerified: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    // Timing-safe check
    const dummyHash =
      '$2b$10$KbQiF2Xk5b9VYy8Ej3Z9UeZ5gVxF5D1ZxJHGtJwQ1xExampleDummyHash';
    const hashToCompare = customer?.password ?? dummyHash;
    const passwordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!customer || !passwordValid) {
      if (customer) {
        await this.incrementLoginAttempts(customer.id);
      }
      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);
    }

    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_LOCKED);
    }

    if (!customer.isActive) {
      throw new UnauthorizedException(AUTH_ERROR.ACCOUNT_DISABLED);
    }

    if (customer.isGuest || !customer.password) {
      throw new UnauthorizedException(AUTH_ERROR.CUSTOMER_IS_GUEST);
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

  /**
   * Request OTP for login
   */
  async requestLoginOtp(
    dto: CustomerOtpLoginRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedTarget: string; expiresInSeconds: number }> {
    const target = dto.type === 'phone' ? dto.value : dto.value.toLowerCase();

    const whereClause =
      dto.type === 'phone'
        ? { phone: target, isGuest: false, deletedAt: null }
        : { email: target, isGuest: false, deletedAt: null };

    const customer = await this.prisma.customer.findFirst({
      where: whereClause,
      select: { id: true, isActive: true },
    });

    // Don't reveal if account exists
    if (!customer || !customer.isActive) {
      const maskedTarget =
        dto.type === 'phone' ? maskPhone(target) : maskEmail(target);
      return { maskedTarget, expiresInSeconds: 300 };
    }

    const result =
      dto.type === 'phone'
        ? await this.phoneOtpService.sendOtp({
            target,
            purpose: 'LOGIN_OTP',
            ipAddress,
            userAgent,
          })
        : await this.emailOtpService.sendOtp({
            target,
            purpose: 'LOGIN_OTP',
            ipAddress,
            userAgent,
          });

    return {
      maskedTarget: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  /**
   * Verify OTP and login
   */
  async loginWithOtp(
    dto: CustomerOtpLoginVerifyDto,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResult> {
    const target = dto.type === 'phone' ? dto.value : dto.value.toLowerCase();

    const otpResult =
      dto.type === 'phone'
        ? await this.phoneOtpService.verifyOtp({
            target,
            purpose: 'LOGIN_OTP',
            code: dto.code,
            consume: true,
          })
        : await this.emailOtpService.verifyOtp({
            target,
            purpose: 'LOGIN_OTP',
            code: dto.code,
            consume: true,
          });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    const whereClause =
      dto.type === 'phone'
        ? { phone: target, isGuest: false, deletedAt: null }
        : { email: target, isGuest: false, deletedAt: null };

    const customer = await this.prisma.customer.findFirst({
      where: whereClause,
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
  // VERIFICATION (for existing users)
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

    await this.prisma.customer.updateMany({
      where: { phone: dto.phone, deletedAt: null },
      data: { phoneVerified: true },
    });
  }

  async requestEmailVerification(
    dto: VerifyEmailRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedEmail: string; expiresInSeconds: number }> {
    const result = await this.emailOtpService.sendOtp({
      target: dto.email.toLowerCase(),
      purpose: 'VERIFY_EMAIL',
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Failed to send OTP');
    }

    return {
      maskedEmail: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async confirmEmailVerification(dto: VerifyEmailConfirmDto): Promise<void> {
    const otpResult = await this.emailOtpService.verifyOtp({
      target: dto.email.toLowerCase(),
      purpose: 'VERIFY_EMAIL',
      code: dto.code,
      consume: true,
    });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    await this.prisma.customer.updateMany({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      data: { emailVerified: true },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ══════════════════════════════════════════════════════════════

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedTarget: string; expiresInSeconds: number }> {
    const target = dto.type === 'phone' ? dto.value : dto.value.toLowerCase();

    const whereClause =
      dto.type === 'phone'
        ? { phone: target, isGuest: false, deletedAt: null }
        : { email: target, isGuest: false, deletedAt: null };

    const customer = await this.prisma.customer.findFirst({
      where: whereClause,
      select: { id: true },
    });

    // Don't reveal if account doesn't exist
    if (!customer) {
      const maskedTarget =
        dto.type === 'phone' ? maskPhone(target) : maskEmail(target);
      return { maskedTarget, expiresInSeconds: 300 };
    }

    const result =
      dto.type === 'phone'
        ? await this.phoneOtpService.sendOtp({
            target,
            purpose: 'RESET_PASSWORD',
            ipAddress,
            userAgent,
          })
        : await this.emailOtpService.sendOtp({
            target,
            purpose: 'RESET_PASSWORD',
            ipAddress,
            userAgent,
          });

    return {
      maskedTarget: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const target = dto.type === 'phone' ? dto.value : dto.value.toLowerCase();

    const otpResult =
      dto.type === 'phone'
        ? await this.phoneOtpService.verifyOtp({
            target,
            purpose: 'RESET_PASSWORD',
            code: dto.code,
            consume: true,
          })
        : await this.emailOtpService.verifyOtp({
            target,
            purpose: 'RESET_PASSWORD',
            code: dto.code,
            consume: true,
          });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    const whereClause =
      dto.type === 'phone'
        ? { phone: target, isGuest: false, deletedAt: null }
        : { email: target, isGuest: false, deletedAt: null };

    const customer = await this.prisma.customer.findFirst({
      where: whereClause,
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { password: hashedPassword },
    });

    // Revoke all sessions
    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customer.id,
      'All_DEVICES',
    );

    this.logger.log(`Password reset for customer: ${target}`);
  }

  // ══════════════════════════════════════════════════════════════
  // ACCOUNT LINKING (Add email to phone account or vice versa)
  // ══════════════════════════════════════════════════════════════

  async requestLinkEmail(
    customerId: string,
    dto: LinkEmailRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedEmail: string; expiresInSeconds: number }> {
    // Check if email already taken
    const emailTaken = await this.prisma.customer.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (emailTaken) {
      throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
    }

    const result = await this.emailOtpService.sendOtp({
      target: dto.email.toLowerCase(),
      purpose: 'VERIFY_EMAIL',
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Failed to send OTP');
    }

    return {
      maskedEmail: result.maskedTarget,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async confirmLinkEmail(
    customerId: string,
    dto: LinkEmailVerifyDto,
  ): Promise<void> {
    const otpResult = await this.emailOtpService.verifyOtp({
      target: dto.email.toLowerCase(),
      purpose: 'VERIFY_EMAIL',
      code: dto.code,
      consume: true,
    });

    if (!otpResult.success) {
      throw new UnauthorizedException(
        otpResult.message ?? AUTH_ERROR.OTP_INVALID,
      );
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        email: dto.email.toLowerCase(),
        emailVerified: true,
      },
    });
  }

  async requestLinkPhone(
    customerId: string,
    dto: LinkPhoneRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ maskedPhone: string; expiresInSeconds: number }> {
    // Check if phone already taken
    const phoneTaken = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, deletedAt: null },
    });

    if (phoneTaken) {
      throw new ConflictException(AUTH_ERROR.CUSTOMER_PHONE_TAKEN);
    }

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

  async confirmLinkPhone(
    customerId: string,
    dto: LinkPhoneVerifyDto,
  ): Promise<void> {
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

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        phone: dto.phone,
        phoneVerified: true,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PASSWORD CHANGE (Authenticated user)
  // ══════════════════════════════════════════════════════════════

  async changePassword(
    customerId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { password: true },
    });

    if (!customer || !customer.password) {
      throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);
    }

    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      customer.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password changed for customer: ${customerId}`);
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

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
