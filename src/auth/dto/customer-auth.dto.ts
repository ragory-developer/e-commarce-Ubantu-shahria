// ─── src/auth/dto/customer-auth.dto.ts ───────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

// ─── Step 1: Request OTP ──────────────────────────────────────
export class CustomerRequestOtpDto {
  @ApiProperty({
    example: '01700000000',
    description: 'Bangladesh phone number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;
}

// ─── Step 2: Verify OTP → returns registrationToken ──────────
export class CustomerVerifyRegistrationOtpDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code!: string;
}

// ─── Optional address during registration ─────────────────────
export class RegisterAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  address!: string;

  @ApiPropertyOptional({ example: 'Near the park' })
  @IsOptional()
  @IsString()
  descriptions?: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  city!: string;

  @ApiProperty({ example: 'Dhaka Division' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  state!: string;

  @ApiPropertyOptional({ example: 'Road 5' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  road?: string;

  @ApiProperty({ example: '1207' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  zip!: string;

  @ApiProperty({ example: 'BD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  country!: string;
}

// ─── Step 3: Complete Registration ───────────────────────────
export class CustomerCompleteRegistrationDto {
  @ApiProperty({
    description:
      'Short-lived registration token received after OTP verification',
  })
  @IsString()
  @IsNotEmpty()
  registrationToken!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({
    description: 'Optional: save a default address during registration',
    type: RegisterAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterAddressDto)
  address?: RegisterAddressDto;

  // ─── Device info ───────────────────────────────────────────
  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-...' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceName?: string;

  @ApiPropertyOptional({
    example: 'mobile',
    enum: ['mobile', 'tablet', 'desktop'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;
}

// ─── Password Login ───────────────────────────────────────────
export class CustomerPasswordLoginDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceName?: string;

  @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;
}

// ─── OTP Login Step 1 ─────────────────────────────────────────
export class CustomerOtpLoginRequestDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;
}

// ─── OTP Login Step 2 ─────────────────────────────────────────
export class CustomerOtpLoginVerifyDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceName?: string;

  @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;
}

// ─── Phone Verification (for guests/registered) ───────────────
export class VerifyPhoneRequestDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;
}

export class VerifyPhoneConfirmDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code!: string;
}

// ─── Forgot / Reset Password ──────────────────────────────────
export class ForgotPasswordDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code!: string;

  @ApiProperty({ example: 'NewSecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

// ─── Shared Token DTOs ────────────────────────────────────────
export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token received during login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deviceId?: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
