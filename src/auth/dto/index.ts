// // ─── src/auth/dto/index.ts ────────────────────────────────────
// // All imports at the top — fixes BUG-3

// import {
//   IsEmail,
//   IsString,
//   IsNotEmpty,
//   MinLength,
//   MaxLength,
//   IsEnum,
//   IsArray,
//   IsOptional,
//   Matches,
//   IsBoolean,
//   ValidateNested,
//   IsIn,
// } from 'class-validator';
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import { AdminRole, AdminPermission } from '@prisma/client';
// import { Transform, Type } from 'class-transformer';

// // ─────────────────────────────────────────────────────────────
// // ADMIN DTOs
// // ─────────────────────────────────────────────────────────────

// export class AdminLoginDto {
//   @ApiProperty({ example: 'admin@example.com' })
//   @IsEmail()
//   @Transform(({ value }) => value?.toLowerCase().trim())
//   email!: string;

//   @ApiProperty({ example: 'SecureP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   @MinLength(8)
//   password!: string;

//   @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceId?: string;

//   @ApiPropertyOptional({ example: 'Chrome on macOS' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceName?: string;

//   @ApiPropertyOptional({
//     example: 'desktop',
//     enum: ['mobile', 'tablet', 'desktop'],
//   })
//   @IsOptional()
//   @IsString()
//   @MaxLength(50)
//   deviceType?: string;
// }

// export class CreateAdminDto {
//   @ApiProperty({ example: 'John' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   firstName!: string;

//   @ApiProperty({ example: 'Doe' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   lastName!: string;

//   @ApiProperty({ example: 'john@example.com' })
//   @IsEmail()
//   @Transform(({ value }) => value?.toLowerCase().trim())
//   email!: string;

//   @ApiPropertyOptional({ example: '+8801700000000' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(20)
//   phone?: string;

//   @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
//   @IsString()
//   @MinLength(8)
//   @MaxLength(72)
//   password!: string;

//   @ApiPropertyOptional({ enum: AdminRole, default: AdminRole.ADMIN })
//   @IsOptional()
//   @IsEnum(AdminRole)
//   role?: AdminRole;

//   @ApiPropertyOptional({ enum: AdminPermission, isArray: true, default: [] })
//   @IsOptional()
//   @IsArray()
//   @IsEnum(AdminPermission, { each: true })
//   permissions?: AdminPermission[];
// }

// export class UpdateAdminPermissionsDto {
//   @ApiPropertyOptional({
//     enum: AdminPermission,
//     isArray: true,
//     description: 'Permissions to ADD to current set',
//   })
//   @IsOptional()
//   @IsArray()
//   @IsEnum(AdminPermission, { each: true })
//   add?: AdminPermission[];

//   @ApiPropertyOptional({
//     enum: AdminPermission,
//     isArray: true,
//     description: 'Permissions to REMOVE from current set',
//   })
//   @IsOptional()
//   @IsArray()
//   @IsEnum(AdminPermission, { each: true })
//   remove?: AdminPermission[];

//   @ApiPropertyOptional({
//     enum: AdminPermission,
//     isArray: true,
//     description: 'REPLACE all permissions with this exact set',
//   })
//   @IsOptional()
//   @IsArray()
//   @IsEnum(AdminPermission, { each: true })
//   set?: AdminPermission[]; // FIX BUG-4: was "replace", service checks "set"
// }

// export class UpdateAdminRoleDto {
//   @ApiProperty({ enum: [AdminRole.ADMIN, AdminRole.MANAGER] })
//   @IsEnum(AdminRole)
//   role!: AdminRole;
// }

// // ─────────────────────────────────────────────────────────────
// // OTP REQUEST DTO (shared for phone and email)
// // ─────────────────────────────────────────────────────────────

// export class OtpRequestDto {
//   @ApiProperty({
//     example: 'phone',
//     description: 'Channel to send OTP through',
//     enum: ['phone', 'email'],
//   })
//   @IsIn(['phone', 'email'])
//   type!: 'phone' | 'email';

//   @ApiProperty({
//     example: '01700000000 OR user@example.com',
//     description: 'Phone number or email address depending on type',
//   })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   value!: string;
// }

// // Kept for backward compatibility
// export class CustomerRequestOtpDto {
//   @ApiProperty({
//     example: '01700000000',
//     description: 'Bangladesh phone number',
//   })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(20)
//   @Transform(({ value }) => value?.trim())
//   phone!: string;
// }

// // ─────────────────────────────────────────────────────────────
// // ADDRESS DTO — defined BEFORE CustomerRegisterDto (fixes BUG-3)
// // ─────────────────────────────────────────────────────────────

// export class RegisterAddressDto {
//   @ApiPropertyOptional({ example: 'Home' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(50)
//   label?: string;

//   @ApiProperty({ example: '123 Main Street' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(191)
//   address!: string;

//   @ApiPropertyOptional({ example: 'Near the central park' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(500)
//   descriptions?: string;

//   @ApiProperty({ example: 'Dhaka' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(191)
//   city!: string;

//   @ApiProperty({ example: 'Dhaka Division' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(191)
//   state!: string;

//   @ApiPropertyOptional({ example: 'Road 5, Block B' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   road?: string;

//   @ApiProperty({ example: '1207' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(20)
//   zip!: string;

//   @ApiProperty({ example: 'BD' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(50)
//   @Transform(({ value }) => value?.trim().toUpperCase())
//   country!: string;
// }

// // ─────────────────────────────────────────────────────────────
// // CUSTOMER REGISTRATION DTOs
// // ─────────────────────────────────────────────────────────────

// /**
//  * Step 1: Request OTP — supports Phone OR Email
//  */
// export class CustomerOtpRequestDto {
//   @ApiProperty({
//     description: 'Registration channel',
//     enum: ['phone', 'email'],
//     example: 'phone',
//   })
//   @IsIn(['phone', 'email'])
//   type!: 'phone' | 'email';

//   @ApiProperty({
//     example: '01700000000 OR user@example.com',
//     description: 'Phone or email depending on type',
//   })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   value!: string;
// }

// /**
//  * Step 2: Complete registration with OTP + profile
//  */
// export class CustomerRegisterDto {
//   @ApiProperty({
//     description: 'Registration channel',
//     enum: ['phone', 'email'],
//   })
//   @IsIn(['phone', 'email'])
//   type!: 'phone' | 'email';

//   @ApiProperty({ example: '01700000000 OR user@example.com' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   value!: string;

//   @ApiProperty({ example: '123456', description: '6-digit OTP code' })
//   @IsString()
//   @IsNotEmpty()
//   @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
//   otpCode!: string;

//   @ApiProperty({ example: 'John' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   firstName!: string;

//   @ApiProperty({ example: 'Doe' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   lastName!: string;

//   @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
//   @IsString()
//   @MinLength(8)
//   @MaxLength(72)
//   password!: string;

//   @ApiProperty({ example: 'SecureP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   confirmPassword!: string;

//   @ApiPropertyOptional({
//     description: 'Optional default address during registration',
//   })
//   @IsOptional()
//   @ValidateNested()
//   @Type(() => RegisterAddressDto)
//   address?: RegisterAddressDto;

//   @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-...' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceId?: string;

//   @ApiPropertyOptional({ example: 'iPhone 15 Pro' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceName?: string;

//   @ApiPropertyOptional({
//     example: 'mobile',
//     enum: ['mobile', 'tablet', 'desktop'],
//   })
//   @IsOptional()
//   @IsString()
//   @MaxLength(50)
//   deviceType?: string;
// }

// /**
//  * Convert guest to registered — just provide password
//  */
// export class ConvertGuestDto {
//   @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
//   @IsString()
//   @MinLength(8)
//   @MaxLength(72)
//   password!: string;

//   @ApiProperty({ example: 'SecureP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   confirmPassword!: string;

//   @ApiPropertyOptional({ example: 'John' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   firstName?: string;

//   @ApiPropertyOptional({ example: 'Doe' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   lastName?: string;

//   @ApiPropertyOptional({ example: 'user@example.com' })
//   @IsOptional()
//   @IsEmail()
//   @Transform(({ value }) => value?.toLowerCase().trim())
//   email?: string;
// }

// export class CustomerPasswordLoginDto {
//   @ApiProperty({ example: '01700000000 OR user@example.com' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   identifier!: string; // phone or email

//   @ApiProperty({ example: 'SecureP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   @MinLength(8)
//   password!: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceId?: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceName?: string;

//   @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
//   @IsOptional()
//   @IsString()
//   @MaxLength(50)
//   deviceType?: string;
// }

// export class CustomerOtpLoginDto {
//   @ApiProperty({ example: '01700000000 OR user@example.com' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   identifier!: string;

//   @ApiProperty({ example: '123456' })
//   @IsString()
//   @IsNotEmpty()
//   @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
//   code!: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceId?: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceName?: string;

//   @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
//   @IsOptional()
//   @IsString()
//   @MaxLength(50)
//   deviceType?: string;
// }

// export class ForgotPasswordDto {
//   @ApiProperty({ example: '01700000000 OR user@example.com' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   identifier!: string; // phone or email
// }

// export class ResetPasswordDto {
//   @ApiProperty({ example: '01700000000 OR user@example.com' })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(255)
//   @Transform(({ value }) => value?.trim())
//   identifier!: string;

//   @ApiProperty({ example: '123456' })
//   @IsString()
//   @IsNotEmpty()
//   @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
//   code!: string;

//   @ApiProperty({ example: 'NewSecureP@ss123', minLength: 8 })
//   @IsString()
//   @MinLength(8)
//   @MaxLength(72)
//   newPassword!: string;

//   @ApiProperty({ example: 'NewSecureP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   confirmNewPassword!: string;
// }

// // ─────────────────────────────────────────────────────────────
// // SHARED DTOs
// // ─────────────────────────────────────────────────────────────

// export class RefreshTokenDto {
//   @ApiProperty({ description: 'Refresh token received during login' })
//   @IsString()
//   @IsNotEmpty()
//   refreshToken!: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsString()
//   @MaxLength(191)
//   deviceId?: string;
// }

// export class LogoutDto {
//   @ApiProperty()
//   @IsString()
//   @IsNotEmpty()
//   refreshToken!: string;
// }

// export class ChangePasswordDto {
//   @ApiProperty({ example: 'OldP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   currentPassword!: string;

//   @ApiProperty({ example: 'NewP@ss123', minLength: 8 })
//   @IsString()
//   @MinLength(8)
//   @MaxLength(72)
//   newPassword!: string;

//   @ApiProperty({ example: 'NewP@ss123' })
//   @IsString()
//   @IsNotEmpty()
//   confirmNewPassword!: string;
// }

// export class UpdateCustomerProfileDto {
//   @ApiPropertyOptional({ example: 'John' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   firstName?: string;

//   @ApiPropertyOptional({ example: 'Doe' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(100)
//   @Transform(({ value }) => value?.trim())
//   lastName?: string;

//   @ApiPropertyOptional({
//     description: 'Avatar image URL only (no file upload)',
//   })
//   @IsOptional()
//   @IsString()
//   @MaxLength(500)
//   avatar?: string;

//   // NOTE: phone and email are intentionally excluded here.
//   // Phone: cannot be changed once verified.
//   // Email: requires its own separate verify-and-update flow.
// }

// export class GuestOrderTrackingDto {
//   @ApiProperty({ example: '1001', description: 'Order number' })
//   @IsString()
//   @IsNotEmpty()
//   orderNumber!: string;

//   @ApiProperty({
//     example: '01700000000',
//     description: 'Phone used during order',
//   })
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(20)
//   phone!: string;
// }
// ─── src/auth/dto/index.ts ────────────────────────────────────

export * from './admin-login.dto';
export * from './customer-auth.dto';
