// src/otp/otp.types.ts

import { OtpChannel, OtpPurpose } from '@prisma/client';

export interface SendOtpOptions {
  target: string;
  purpose: OtpPurpose;
  recipientName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyOtpOptions {
  target: string;
  purpose: OtpPurpose;
  code: string;
  consume?: boolean;
}

export interface SendOtpResult {
  success: boolean;
  maskedTarget: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  channel: OtpChannel;
  message?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  verified?: boolean;
  attemptsRemaining?: number; // Added - was missing
}

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
