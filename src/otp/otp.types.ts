/**
 * src/otp/otp.types.ts
 *
 * TypeScript types and interfaces for the OTP system.
 */

import { OtpChannel, OtpPurpose } from '@prisma/client';

// ─── Request/Response Types ──────────────────────────────────

export interface SendOtpOptions {
  target: string; // Phone number or email
  purpose: OtpPurpose;
  recipientName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyOtpOptions {
  target: string;
  purpose: OtpPurpose;
  code: string;
  consume?: boolean; // Mark as verified after successful verification
}

export interface SendOtpResult {
  success: boolean;
  maskedTarget: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  message?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  verified?: boolean;
}

// ─── Internal Types ──────────────────────────────────────────

export interface OtpRecord {
  id: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  target: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  verifiedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface RateLimitCheck {
  allowed: boolean;
  count?: number;
  resetAt?: Date;
}
