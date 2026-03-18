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
  IsIn,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

// ══════════════════════════════════════════════════════════════
// REGISTRATION FLOW (Phone or Email)
// ══════════════════════════════════════════════════════════════

// ─── Step 1: Request OTP ──────────────────────────────────────
export class CustomerRequestOtpDto {
  @ApiProperty({
    example: 'phone',
    description: 'Registration method: phone or email',
    enum: ['phone', 'email'],
  })
  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @ApiProperty({
    example: '01700000000',
    description:
      'Phone number (if type=phone) or email address (if type=email)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  value!: string;
}

// ─── Step 2: Verify OTP → returns registrationToken ──────────
export class CustomerVerifyRegistrationOtpDto {
  @ApiProperty({
    example: 'phone',
    enum: ['phone', 'email'],
  })
  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  value!: string;

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

  @ApiProperty({ example: '01245647897' })
  @IsPhoneNumber()
  // @Transform(({ value }) => value?.toLowerCase().trim())
  phone!: string;

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

// ══════════════════════════════════════════════════════════════
// LOGIN FLOW
// ══════════════════════════════════════════════════════════════

// ─── Password Login (Phone or Email) ──────────────────────────
export class CustomerPasswordLoginDto {
  @ApiProperty({
    example: '01700000000',
    description: 'Phone number or email address',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  identifier!: string;

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

// ─── OTP Login Step 1: Request OTP ────────────────────────────
export class CustomerOtpLoginRequestDto {
  @ApiProperty({
    example: 'phone',
    enum: ['phone', 'email'],
  })
  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @ApiProperty({
    example: '01700000000',
    description: 'Phone number or email address',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  value!: string;
}

// ─── OTP Login Step 2: Verify OTP ─────────────────────────────
export class CustomerOtpLoginVerifyDto {
  @ApiProperty({
    example: 'phone',
    enum: ['phone', 'email'],
  })
  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  value!: string;

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

// ══════════════════════════════════════════════════════════════
// VERIFICATION FLOWS
// ══════════════════════════════════════════════════════════════

// ─── Verify Phone (for existing users) ───────────────────────
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

// ─── Verify Email (for existing users) ───────────────────────
export class VerifyEmailRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

export class VerifyEmailConfirmDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code!: string;
}

// ══════════════════════════════════════════════════════════════
// PASSWORD RESET
// ══════════════════════════════════════════════════════════════

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'phone',
    enum: ['phone', 'email'],
  })
  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @ApiProperty({
    example: '01700000000',
    description: 'Phone number or email address',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  value!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'phone',
    enum: ['phone', 'email'],
  })
  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  value!: string;

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

// ══════════════════════════════════════════════════════════════
// TOKEN & SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════
// PROFILE MANAGEMENT
// ══════════════════════════════════════════════════════════════

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ss123' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'NewP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

// ══════════════════════════════════════════════════════════════
// ACCOUNT LINKING (Add email to phone account or vice versa)
// ══════════════════════════════════════════════════════════════

export class LinkEmailRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

export class LinkEmailVerifyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code!: string;
}

export class LinkPhoneRequestDto {
  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  phone!: string;
}

export class LinkPhoneVerifyDto {
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
