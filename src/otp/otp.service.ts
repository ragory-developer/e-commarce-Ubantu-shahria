/**
 * src/otp/otp.service.ts
 *
 * Core OTP service - handles generation, storage, verification, and rate limiting.
 */

import { Injectable, Logger } from '@nestjs/common';
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

  // ─── Generate Random OTP Code ────────────────────────────────
  generateCode(): string {
    const min = Math.pow(10, OTP_CONFIG.CODE_LENGTH - 1);
    const max = Math.pow(10, OTP_CONFIG.CODE_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  // ─── Hash OTP Code (bcrypt for security) ────────────────────
  async hashCode(code: string): Promise<string> {
    return await bcrypt.hash(code, 10);
  }

  // ─── Compare OTP Code (timing-safe) ──────────────────────────
  async compareCode(code: string, hash: string): Promise<boolean> {
    return bcrypt.compare(code, hash);
  }

  // ─── Mask Target (Privacy) ───────────────────────────────────
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

  // ─── Rate Limit Check ────────────────────────────────────────
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

  // ─── Check Resend Cooldown ───────────────────────────────────
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

  // ─── Store OTP ───────────────────────────────────────────────
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

  // ─── Verify OTP ──────────────────────────────────────────────
  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    // Find active OTP
    const otp = await this.prisma.verificationOtp.findFirst({
      where: {
        target: options.target,
        purpose: options.purpose,
        verified: false,
        expiresAt: { gt: new Date() },
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

    // Compare codes
    const isValid = await this.compareCode(options.code, otp.codeHash);

    if (!isValid) {
      // Increment attempts
      await this.prisma.verificationOtp.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });

      // Check if this was the last attempt
      if (otp.attempts + 1 >= otp.maxAttempts) {
        return { success: false, message: OTP_ERROR.MAX_ATTEMPTS };
      }

      return { success: false, message: OTP_ERROR.INVALID };
    }

    // Valid OTP - mark as verified if consume=true
    if (options.consume) {
      await this.prisma.verificationOtp.update({
        where: { id: otp.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });
    }

    this.logger.log(
      `OTP verified for ${this.maskTarget(options.target, otp.channel)} (${options.purpose})`,
    );

    return { success: true, verified: true };
  }

  // ─── Cleanup Expired OTPs (call from scheduled task) ────────
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.prisma.verificationOtp.deleteMany({
      where: {
        OR: [
          {
            verified: true,
            verifiedAt: { lt: new Date(Date.now() - 86400000) },
          }, // 24h old verified
          { expiresAt: { lt: new Date() } }, // Expired
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired OTP records`);
    return result.count;
  }
}
