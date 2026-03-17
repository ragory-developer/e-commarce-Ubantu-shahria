// ─── src/auth/auth.controller.ts ─────────────────────────────
// Enhanced authentication controller with email + phone support

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AdminAuthService } from './admin-auth.service';
import { CustomerAuthService } from './customer-auth.service';
import { TokenService } from './token.service';
import { AdminService } from '../admin/admin.service';
import { CustomerService } from '../customer/customer.service';

import {
  AdminLoginDto,
  CustomerRequestOtpDto,
  CustomerVerifyRegistrationOtpDto,
  CustomerCompleteRegistrationDto,
  CustomerPasswordLoginDto,
  CustomerOtpLoginRequestDto,
  CustomerOtpLoginVerifyDto,
  VerifyPhoneRequestDto,
  VerifyPhoneConfirmDto,
  VerifyEmailRequestDto,
  VerifyEmailConfirmDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  LogoutDto,
  LinkEmailRequestDto,
  LinkEmailVerifyDto,
  LinkPhoneRequestDto,
  LinkPhoneVerifyDto,
  ChangePasswordDto,
} from './dto';

import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from './auth.types';
import { AUTH_MESSAGES } from './auth.constants';

// ─── Helper: extract device info from request ─────────────────
function extractDeviceInfo(req: Request, body: any) {
  return {
    clientDeviceId: body.deviceId ?? generateFallbackDeviceId(req),
    deviceName: body.deviceName as string | undefined,
    deviceType: body.deviceType as string | undefined,
    ipAddress:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      undefined,
    userAgent: req.headers['user-agent'] ?? undefined,
  };
}

function generateFallbackDeviceId(req: Request): string {
  const ua = req.headers['user-agent'] ?? '';
  const ip = req.socket.remoteAddress ?? '';
  const raw = `${ua}:${ip}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) + hash + raw.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly customerAuthService: CustomerAuthService,
    private readonly tokenService: TokenService,
    private readonly adminService: AdminService,
    private readonly customerService: CustomerService,
    private readonly prisma: PrismaService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // ADMIN AUTH
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login with email + password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Login successful',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'a1b2c3d4e5f6g7h8i9j0...',
          expiresIn: 900,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async adminLogin(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const deviceInfo = extractDeviceInfo(req, dto);
    const result = await this.adminAuthService.adminLogin(dto, deviceInfo);
    return {
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER REGISTRATION — 3-STEP FLOW (Phone or Email)
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('customer/register/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Step 1] Send OTP for registration (phone or email)',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP sent to 0170****000',
        data: {
          maskedTarget: '0170****000',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async requestRegistrationOtp(
    @Body() dto: CustomerRequestOtpDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.customerAuthService.requestRegistrationOtp(
      dto,
      ip,
      ua,
    );

    return {
      message: `${AUTH_MESSAGES.OTP_SENT} to ${result.maskedTarget}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Step 2] Verify OTP → returns registrationToken (15 min)',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP verified successfully',
        data: {
          registrationToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          maskedTarget: '0170****000',
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async verifyRegistrationOtp(@Body() dto: CustomerVerifyRegistrationOtpDto) {
    const result = await this.customerAuthService.verifyRegistrationOtp(
      dto.type,
      dto.value,
      dto.code,
    );

    return {
      message: AUTH_MESSAGES.OTP_VERIFIED,
      data: result,
    };
  }

  @Public()
  @Post('customer/register/complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Step 3] Complete registration with registrationToken + profile',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Registration completed successfully',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'a1b2c3d4e5f6g7h8i9j0...',
          expiresIn: 900,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async completeRegistration(
    @Body() dto: CustomerCompleteRegistrationDto,
    @Req() req: Request,
  ) {
    const deviceInfo = extractDeviceInfo(req, dto);
    const result = await this.customerAuthService.completeRegistration(
      dto,
      deviceInfo,
    );

    return {
      message: AUTH_MESSAGES.REGISTRATION_COMPLETE,
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER LOGIN
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('customer/login/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer login with phone/email + password' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Login successful',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'a1b2c3d4e5f6g7h8i9j0...',
          expiresIn: 900,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async customerPasswordLogin(
    @Body() dto: CustomerPasswordLoginDto,
    @Req() req: Request,
  ) {
    const deviceInfo = extractDeviceInfo(req, dto);
    const result = await this.customerAuthService.loginWithPassword(
      dto,
      deviceInfo,
    );

    return {
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  @Public()
  @Post('customer/login/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Step 1] Request OTP for login (phone or email)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP sent to 0170****000',
        data: {
          maskedTarget: '0170****000',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async requestLoginOtp(
    @Body() dto: CustomerOtpLoginRequestDto,
    @Req() req: Request,
  ) {
    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestLoginOtp(dto, ip, ua);

    return {
      message: `${AUTH_MESSAGES.OTP_SENT} to ${result.maskedTarget}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/login/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Step 2] Verify OTP and login' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Login successful',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'a1b2c3d4e5f6g7h8i9j0...',
          expiresIn: 900,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async customerOtpLogin(
    @Body() dto: CustomerOtpLoginVerifyDto,
    @Req() req: Request,
  ) {
    const deviceInfo = extractDeviceInfo(req, dto);
    const result = await this.customerAuthService.loginWithOtp(dto, deviceInfo);

    return {
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // VERIFICATION (Phone & Email)
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('customer/verify-phone/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request phone verification OTP' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP sent to 0170****000',
        data: {
          maskedPhone: '0170****000',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async requestPhoneVerification(
    @Body() dto: VerifyPhoneRequestDto,
    @Req() req: Request,
  ) {
    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestPhoneVerification(
      dto,
      ip,
      ua,
    );

    return {
      message: `${AUTH_MESSAGES.OTP_SENT} to ${result.maskedPhone}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/verify-phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm phone verification OTP' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Phone number verified successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async confirmPhoneVerification(@Body() dto: VerifyPhoneConfirmDto) {
    await this.customerAuthService.confirmPhoneVerification(dto);
    return { message: AUTH_MESSAGES.PHONE_VERIFIED, data: null };
  }

  @Public()
  @Post('customer/verify-email/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email verification OTP' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP sent to us****@example.com',
        data: {
          maskedEmail: 'us****@example.com',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async requestEmailVerification(
    @Body() dto: VerifyEmailRequestDto,
    @Req() req: Request,
  ) {
    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestEmailVerification(
      dto,
      ip,
      ua,
    );

    return {
      message: `${AUTH_MESSAGES.OTP_SENT} to ${result.maskedEmail}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/verify-email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email verification OTP' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Email address verified successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async confirmEmailVerification(@Body() dto: VerifyEmailConfirmDto) {
    await this.customerAuthService.confirmEmailVerification(dto);
    return { message: AUTH_MESSAGES.EMAIL_VERIFIED, data: null };
  }

  // ─── src/auth/auth.controller.ts (Part 2) ────────────────────
  // Continuation of auth controller...

  // ══════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('customer/password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP (phone or email)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Password reset OTP sent',
        data: {
          maskedTarget: '0170****000',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestPasswordReset(
      dto,
      ip,
      ua,
    );

    return {
      message: AUTH_MESSAGES.PASSWORD_RESET_OTP_SENT,
      data: result,
    };
  }

  @Public()
  @Post('customer/password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Password reset successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.customerAuthService.resetPassword(dto);
    return { message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS, data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // PASSWORD CHANGE (Authenticated)
  // ══════════════════════════════════════════════════════════════

  @ApiBearerAuth('access-token')
  @Post('customer/password/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (requires current password)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Password changed successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.type !== 'CUSTOMER') {
      throw new Error('Only customers can change password via this endpoint');
    }
    await this.customerAuthService.changePassword(user.id, dto);
    return { message: AUTH_MESSAGES.PASSWORD_CHANGED, data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // ACCOUNT LINKING (Add email/phone to existing account)
  // ══════════════════════════════════════════════════════════════

  @ApiBearerAuth('access-token')
  @Post('customer/link/email/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Authenticated] Link email to phone-based account',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP sent to us****@example.com',
        data: {
          maskedEmail: 'us****@example.com',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async requestLinkEmail(
    @Body() dto: LinkEmailRequestDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    if (user.type !== 'CUSTOMER') {
      throw new Error('Only customers can link email');
    }

    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestLinkEmail(
      user.id,
      dto,
      ip,
      ua,
    );

    return {
      message: `${AUTH_MESSAGES.OTP_SENT} to ${result.maskedEmail}`,
      data: result,
    };
  }

  @ApiBearerAuth('access-token')
  @Post('customer/link/email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Authenticated] Verify OTP and link email' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Email address verified successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async confirmLinkEmail(
    @Body() dto: LinkEmailVerifyDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.type !== 'CUSTOMER') {
      throw new Error('Only customers can link email');
    }

    await this.customerAuthService.confirmLinkEmail(user.id, dto);
    return { message: AUTH_MESSAGES.EMAIL_VERIFIED, data: null };
  }

  @ApiBearerAuth('access-token')
  @Post('customer/link/phone/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Authenticated] Link phone to email-based account',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OTP sent to 0170****000',
        data: {
          maskedPhone: '0170****000',
          expiresInSeconds: 300,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async requestLinkPhone(
    @Body() dto: LinkPhoneRequestDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    if (user.type !== 'CUSTOMER') {
      throw new Error('Only customers can link phone');
    }

    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestLinkPhone(
      user.id,
      dto,
      ip,
      ua,
    );

    return {
      message: `${AUTH_MESSAGES.OTP_SENT} to ${result.maskedPhone}`,
      data: result,
    };
  }

  @ApiBearerAuth('access-token')
  @Post('customer/link/phone/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Authenticated] Verify OTP and link phone' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Phone number verified successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async confirmLinkPhone(
    @Body() dto: LinkPhoneVerifyDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.type !== 'CUSTOMER') {
      throw new Error('Only customers can link phone');
    }

    await this.customerAuthService.confirmLinkPhone(user.id, dto);
    return { message: AUTH_MESSAGES.PHONE_VERIFIED, data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // TOKEN & SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token → new token pair' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Token refreshed successfully',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'a1b2c3d4e5f6g7h8i9j0...',
          expiresIn: 900,
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    const { tokens } = await this.tokenService.rotateRefreshToken(
      dto.refreshToken,
      dto.deviceId,
    );

    return {
      message: AUTH_MESSAGES.TOKEN_REFRESHED,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from current device' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Logged out successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async logout(@Body() dto: LogoutDto, @CurrentUser() user: RequestUser) {
    await this.tokenService.revokeToken(dto.refreshToken);
    await this.tokenService.revokeDeviceTokens(user.deviceId, 'LOGOUT');
    return { message: AUTH_MESSAGES.LOGOUT_SUCCESS, data: null };
  }

  @ApiBearerAuth('access-token')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Logged out from all devices',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async logoutAll(@CurrentUser() user: RequestUser) {
    await this.tokenService.revokeAllOwnerTokens(
      user.type,
      user.id,
      'All_DEVICES',
    );
    return { message: AUTH_MESSAGES.LOGOUT_ALL_SUCCESS, data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════════════════════════

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Profile retrieved successfully',
        data: {
          id: 'cuid123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '01700000000',
          phoneVerified: true,
          emailVerified: true,
          isActive: true,
          userType: 'CUSTOMER',
        },
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async getMe(@CurrentUser() user: RequestUser) {
    if (user.type === 'ADMIN') {
      const profile = await this.adminService.getProfile(user.id);
      return {
        message: AUTH_MESSAGES.PROFILE_RETRIEVED,
        data: { ...profile, userType: 'ADMIN' },
      };
    } else {
      const profile = await this.customerService.getProfile(user.id);
      return {
        message: AUTH_MESSAGES.PROFILE_RETRIEVED,
        data: { ...profile, userType: 'CUSTOMER' },
      };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // DEVICE MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  @ApiBearerAuth('access-token')
  @Get('devices')
  @ApiOperation({ summary: 'List all active devices for current user' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Devices retrieved successfully',
        data: [
          {
            id: 'dev123',
            deviceId: 'a1b2c3d4-e5f6-...',
            deviceName: 'iPhone 15 Pro',
            deviceType: 'mobile',
            ipAddress: '192.168.1.1',
            lastActiveAt: '2024-03-17T10:30:00.000Z',
            createdAt: '2024-03-01T08:00:00.000Z',
          },
        ],
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async getDevices(@CurrentUser() user: RequestUser) {
    const ownerWhere =
      user.type === 'ADMIN' ? { adminId: user.id } : { customerId: user.id };

    const devices = await this.prisma.device.findMany({
      where: { ...ownerWhere, isActive: true },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        deviceType: true,
        ipAddress: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return { message: AUTH_MESSAGES.DEVICES_RETRIEVED, data: devices };
  }

  @ApiBearerAuth('access-token')
  @Delete('devices/:deviceDbId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout a specific device by its DB ID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Device removed successfully',
        data: null,
        timestamp: '2024-03-17T10:30:00.000Z',
      },
    },
  })
  async revokeDevice(
    @Param('deviceDbId') deviceDbId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const ownerWhere =
      user.type === 'ADMIN' ? { adminId: user.id } : { customerId: user.id };

    const device = await this.prisma.device.findFirst({
      where: { id: deviceDbId, ...ownerWhere },
    });

    if (!device) {
      return { message: 'Device not found', data: null };
    }

    await this.tokenService.revokeDeviceTokens(deviceDbId, 'DEVICE_LOGOUT');
    return { message: AUTH_MESSAGES.DEVICE_REMOVED, data: null };
  }
}
