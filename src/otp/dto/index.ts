// ─── src/otp/dto/index.ts ────────────────────────────────────

import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose, OtpChannel } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────
 * REQUEST DTOs
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Send OTP Request DTO
 * Used for email and phone OTP requests
 */
export class SendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address or phone number',
  })
  @IsNotEmpty()
  @IsString()
  target!: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: 'VERIFY_EMAIL',
    description:
      'Purpose of OTP: VERIFY_EMAIL, VERIFY_PHONE, RESET_PASSWORD, LOGIN_OTP, REGISTER_ACCOUNT',
  })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Recipient name (optional, for personalization)',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({
    enum: OtpChannel,
    description:
      'Channel to send OTP (EMAIL or SMS). If not specified, will be auto-detected',
  })
  @IsOptional()
  @IsEnum(OtpChannel)
  channel?: OtpChannel;
}

/**
 * Verify OTP Request DTO
 * Used to verify the OTP code
 */
export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address or phone number',
  })
  @IsNotEmpty()
  @IsString()
  target!: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: 'VERIFY_EMAIL',
  })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to consume/mark OTP as used (default: true)',
  })
  @IsOptional()
  consume?: boolean;
}

/**
 * Resend OTP Request DTO
 * Used to resend OTP after cooldown
 */
export class ResendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address or phone number',
  })
  @IsNotEmpty()
  @IsString()
  target!: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: 'VERIFY_EMAIL',
  })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiPropertyOptional({
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;
}

/**
 * Validate OTP Without Consuming Request DTO
 * Check if OTP is valid without marking it as used
 */
export class ValidateOtpDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  target!: string;

  @ApiProperty({
    enum: OtpPurpose,
  })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiProperty({
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string;
}

/**
 * ─────────────────────────────────────────────────────────────
 * RESPONSE DTOs
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Send OTP Response DTO
 */
export class SendOtpResponseDto {
  success!: boolean;
  maskedTarget!: string;
  expiresInSeconds!: number;
  resendAfterSeconds!: number;
  channel!: OtpChannel;
  message?: string;
}

/**
 * Verify OTP Response DTO
 */
export class VerifyOtpResponseDto {
  success!: boolean;
  verified?: boolean;
  message?: string;
  consumedAt?: Date;
}

/**
 * Validate OTP Response DTO
 */
export class ValidateOtpResponseDto {
  success!: boolean;
  valid?: boolean;
  message?: string;
  expiresInSeconds?: number;
  attemptsRemaining?: number;
}

/**
 * OTP Status Response DTO
 */
export class OtpStatusResponseDto {
  id!: string;
  target!: string;
  purpose!: OtpPurpose;
  channel!: OtpChannel;
  verified!: boolean;
  expiresAt!: Date;
  attemptsRemaining!: number;
  createdAt!: Date;
  verifiedAt?: Date;
}
