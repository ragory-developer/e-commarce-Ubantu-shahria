/**
 * src/otp/otp.service.ts
 *
 * Enhanced OTP service with complete verification logic, rate limiting,
 * and security features for production use.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_CONFIG, OTP_ERROR } from './otp.constants';
import {
  SendOtpOptions,
  VerifyOtpOptions,
  VerifyOtpResult,
  RateLimitCheck,
} from './otp.types';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ═══════════════════════════════════════════════════════════
   * CODE GENERATION & HASHING
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Generate random OTP code
   * @returns 6-digit numeric code as string
   */
  generateCode(): string {
    const min = Math.pow(10, OTP_CONFIG.CODE_LENGTH - 1);
    const max = Math.pow(10, OTP_CONFIG.CODE_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Hash OTP code using bcrypt
   * @param code - Plain text OTP code
   * @returns Hashed code
   */
  async hashCode(code: string): Promise<string> {
    return await bcrypt.hash(code, 10);
  }

  /**
   * Compare OTP code with hash (timing-safe)
   * @param code - Plain text OTP code
   * @param hash - Hashed OTP code
   * @returns True if code matches hash
   */
  async compareCode(code: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(code, hash);
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * CHANNEL & TARGET VALIDATION
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Detect OTP channel from target (email or phone)
   * @param target - Email or phone number
   * @returns Detected channel: EMAIL or SMS
   */
  detectChannel(target: string): OtpChannel {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(target) ? 'EMAIL' : 'SMS';
  }

  /**
   * Validate target format
   * @param target - Email or phone number
   * @param channel - OTP channel
   * @throws BadRequestException if format is invalid
   */
  validateTargetFormat(target: string, channel: OtpChannel): void {
    if (!target || target.trim().length === 0) {
      throw new BadRequestException('Target (email or phone) is required');
    }

    if (channel === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(target)) {
        throw new BadRequestException('Invalid email address format');
      }
    } else if (channel === 'SMS') {
      // Phone number validation: at least 10 digits
      const phoneRegex = /^\d{10,}$/;
      const cleaned = target.replace(/[\s\-()+]/g, '');
      if (!phoneRegex.test(cleaned)) {
        throw new BadRequestException(
          'Invalid phone number. Must contain at least 10 digits',
        );
      }
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * PRIVACY & MASKING
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Mask target for privacy
   * @param target - Email or phone number
   * @param channel - OTP channel
   * @returns Masked target
   */
  maskTarget(target: string, channel: OtpChannel): string {
    if (channel === 'EMAIL') {
      const [local, domain] = target.split('@');
      if (!local || !domain) return '***@***';
      const visibleLocal = local.length > 2 ? local.substring(0, 2) : local[0];
      return `${visibleLocal}****@${domain}`;
    } else {
      // SMS - show first 4 and last 3 digits
      if (target.length < 7) return '****';
      const start = target.substring(0, 4);
      const end = target.substring(target.length - 3);
      return `${start}****${end}`;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * RATE LIMITING
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Check if target exceeds rate limit
   * @param target - Email or phone number
   * @param purpose - OTP purpose
   * @returns Rate limit check result
   */
  async checkRateLimit(
    target: string,
    purpose: OtpPurpose,
  ): Promise<RateLimitCheck> {
    const windowStart = new Date(Date.now() - OTP_CONFIG.RATE_LIMIT.WINDOW_MS);

    const count = await this.prisma.verificationOtp.count({
      where: {
        target,
        purpose,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= OTP_CONFIG.RATE_LIMIT.MAX_PER_HOUR) {
      return {
        allowed: false,
        count,
        resetAt: new Date(
          windowStart.getTime() + OTP_CONFIG.RATE_LIMIT.WINDOW_MS,
        ),
      };
    }

    return { allowed: true, count };
  }

  /**
   * Check resend cooldown period
   * @param target - Email or phone number
   * @param purpose - OTP purpose
   * @returns True if still in cooldown
   */
  async checkResendCooldown(
    target: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const cooldownEnd = new Date(
      Date.now() - OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000,
    );

    const recent = await this.prisma.verificationOtp.findFirst({
      where: {
        target,
        purpose,
        createdAt: { gte: cooldownEnd },
      },
      orderBy: { createdAt: 'desc' },
    });

    return !!recent;
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * OTP STORAGE & LIFECYCLE
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Store OTP in database
   * Invalidates previous active OTPs for same target+purpose
   * @param channel - OTP channel
   * @param options - Send OTP options
   * @param codeHash - Hashed OTP code
   */
  async storeOtp(
    channel: OtpChannel,
    options: SendOtpOptions,
    codeHash: string,
  ): Promise<void> {
    const expirySeconds = OTP_CONFIG.EXPIRY_SECONDS[options.purpose];
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // Invalidate all previous active OTPs for same target+purpose
    await this.prisma.verificationOtp.updateMany({
      where: {
        target: options.target,
        purpose: options.purpose,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(), // Expire immediately
      },
    });

    // Create new OTP record
    await this.prisma.verificationOtp.create({
      data: {
        channel,
        purpose: options.purpose,
        target: options.target,
        codeHash,
        expiresAt,
        attempts: 0,
        maxAttempts: OTP_CONFIG.MAX_ATTEMPTS,
        verified: false,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      },
    });

    this.logger.log(
      `OTP stored for ${this.maskTarget(options.target, channel)} (${options.purpose})`,
    );
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * OTP VERIFICATION
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Verify OTP code
   * @param options - Verification options including code and consume flag
   * @returns Verification result
   */
  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    // Validate code format
    if (!options.code || !/^\d{6}$/.test(options.code)) {
      return { success: false, message: OTP_ERROR.INVALID };
    }

    // Find active OTP
    const otp = await this.prisma.verificationOtp.findFirst({
      where: {
        target: options.target,
        purpose: options.purpose,
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return { success: false, message: OTP_ERROR.NOT_FOUND };
    }

    // Check if expired
    if (otp.expiresAt < new Date()) {
      return { success: false, message: OTP_ERROR.EXPIRED };
    }

    // Check max attempts
    if (otp.attempts >= otp.maxAttempts) {
      return { success: false, message: OTP_ERROR.MAX_ATTEMPTS };
    }

    // Compare codes (timing-safe comparison)
    const isValid = await this.compareCode(options.code, otp.codeHash);

    if (!isValid) {
      // Increment attempts
      const updatedOtp = await this.prisma.verificationOtp.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });

      // Check if this was the last attempt
      if (updatedOtp.attempts >= otp.maxAttempts) {
        return {
          success: false,
          message: OTP_ERROR.MAX_ATTEMPTS,
        };
      }

      const attemptsRemaining = otp.maxAttempts - (otp.attempts + 1);
      return {
        success: false,
        message: OTP_ERROR.INVALID,
        attemptsRemaining,
      };
    }

    // Valid OTP - consume if requested
    if (options.consume === true) {
      await this.prisma.verificationOtp.update({
        where: { id: otp.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      this.logger.log(
        `OTP verified and consumed for ${this.maskTarget(options.target, otp.channel)} (${options.purpose})`,
      );
    } else {
      this.logger.log(
        `OTP validated (not consumed) for ${this.maskTarget(options.target, otp.channel)} (${options.purpose})`,
      );
    }

    return { success: true, verified: true };
  }

  /**
   * Get OTP status without consuming it
   * @param target - Email or phone number
   * @param purpose - OTP purpose
   * @returns OTP status information
   */
  async getOtpStatus(target: string, purpose: OtpPurpose) {
    const otp = await this.prisma.verificationOtp.findFirst({
      where: {
        target,
        purpose,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        target: true,
        purpose: true,
        channel: true,
        verified: true,
        expiresAt: true,
        attempts: true,
        maxAttempts: true,
        createdAt: true,
        verifiedAt: true,
      },
    });

    if (!otp) {
      return null;
    }

    return {
      id: otp.id,
      target: otp.target,
      purpose: otp.purpose,
      channel: otp.channel,
      verified: otp.verified,
      expiresAt: otp.expiresAt,
      expiresInSeconds: Math.floor(
        (otp.expiresAt.getTime() - Date.now()) / 1000,
      ),
      attemptsRemaining: otp.maxAttempts - otp.attempts,
      createdAt: otp.createdAt,
      verifiedAt: otp.verifiedAt,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * CLEANUP & MAINTENANCE
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Cleanup expired OTPs (call from scheduled task)
   * Removes OTPs that are older than retention period
   * @returns Number of deleted records
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.prisma.verificationOtp.deleteMany({
      where: {
        OR: [
          {
            verified: true,
            verifiedAt: { lt: new Date(Date.now() - 86400000) }, // 24h old verified
          },
          {
            expiresAt: { lt: new Date() }, // Expired
          },
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired OTP records`);
    return result.count;
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * ADMIN OPERATIONS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Force invalidate OTP (admin operation)
   * @param target - Email or phone number
   * @param purpose - OTP purpose
   */
  async forceInvalidate(target: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.verificationOtp.updateMany({
      where: {
        target,
        purpose,
        verified: false,
      },
      data: {
        expiresAt: new Date(), // Expire immediately
      },
    });

    this.logger.warn(
      `Force invalidated OTPs for ${this.maskTarget(target, this.detectChannel(target))} (${purpose})`,
    );
  }

  /**
   * Get all active OTPs for a target (admin operation)
   * @param target - Email or phone number
   */
  async getActiveOtps(target: string) {
    return this.prisma.verificationOtp.findMany({
      where: {
        target,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        purpose: true,
        channel: true,
        expiresAt: true,
        attempts: true,
        maxAttempts: true,
        createdAt: true,
      },
    });
  }
}
