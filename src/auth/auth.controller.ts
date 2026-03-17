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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  LogoutDto,
} from './dto';

import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from './auth.types';

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
  async adminLogin(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const deviceInfo = extractDeviceInfo(req, dto);
    const result = await this.adminAuthService.adminLogin(dto, deviceInfo);
    return {
      message: 'Login successful',
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER REGISTRATION — 3-STEP FLOW
  // ══════════════════════════════════════════════════════════════

  // Step 1 — Send OTP
  @Public()
  @Post('customer/register/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Step 1] Send OTP to phone for registration' })
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
      message: `OTP sent to ${result.maskedPhone}`,
      data: result,
    };
  }

  // Step 2 — Verify OTP → get registrationToken
  @Public()
  @Post('customer/register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Step 2] Verify OTP → returns registrationToken (15 min)',
  })
  async verifyRegistrationOtp(@Body() dto: CustomerVerifyRegistrationOtpDto) {
    const result = await this.customerAuthService.verifyRegistrationOtp(
      dto.phone,
      dto.code,
    );
    return {
      message: 'OTP verified. Use registrationToken to complete registration.',
      data: result,
    };
  }

  // Step 3 — Complete registration with profile data
  @Public()
  @Post('customer/register/complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Step 3] Complete registration with registrationToken + profile',
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
      message: 'Registration successful',
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
  @ApiOperation({ summary: 'Customer login with phone + password' })
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
      message: 'Login successful',
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
  @ApiOperation({ summary: '[Step 1] Request OTP for OTP-based login' })
  async requestLoginOtp(
    @Body() dto: CustomerOtpLoginRequestDto,
    @Req() req: Request,
  ) {
    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestLoginOtp(dto, ip, ua);
    return {
      message: `OTP sent to ${result.maskedPhone}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/login/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Step 2] Verify OTP and login' })
  async customerOtpLogin(
    @Body() dto: CustomerOtpLoginVerifyDto,
    @Req() req: Request,
  ) {
    const deviceInfo = extractDeviceInfo(req, dto);
    const result = await this.customerAuthService.loginWithOtp(dto, deviceInfo);
    return {
      message: 'Login successful',
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // PHONE VERIFICATION (guests can verify their phone)
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('customer/verify-phone/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request phone verification OTP (for guests)' })
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
      message: `Verification OTP sent to ${result.maskedPhone}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/verify-phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm phone verification OTP' })
  async confirmPhoneVerification(@Body() dto: VerifyPhoneConfirmDto) {
    await this.customerAuthService.confirmPhoneVerification(dto);
    return { message: 'Phone verified successfully', data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('customer/password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.customerAuthService.requestPasswordReset(
      dto,
      ip,
      ua,
    );
    return {
      message: `Reset OTP sent to ${result.maskedPhone}`,
      data: result,
    };
  }

  @Public()
  @Post('customer/password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.customerAuthService.resetPassword(dto);
    return { message: 'Password reset successfully', data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // SHARED — Token & Session Management
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token → new token pair' })
  async refresh(@Body() dto: RefreshTokenDto) {
    const { tokens } = await this.tokenService.rotateRefreshToken(
      dto.refreshToken,
      dto.deviceId,
    );
    return {
      message: 'Token refreshed',
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
  async logout(@Body() dto: LogoutDto, @CurrentUser() user: RequestUser) {
    await this.tokenService.revokeToken(dto.refreshToken);
    await this.tokenService.revokeDeviceTokens(user.deviceId, 'LOGOUT');
    return { message: 'Logged out successfully', data: null };
  }

  @ApiBearerAuth('access-token')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@CurrentUser() user: RequestUser) {
    await this.tokenService.revokeAllOwnerTokens(
      user.type,
      user.id,
      'All_DEVICES',
    );
    return { message: 'Logged out from all devices', data: null };
  }

  // ─── GET /auth/me ─────────────────────────────────────────────
  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(@CurrentUser() user: RequestUser) {
    if (user.type === 'ADMIN') {
      const profile = await this.adminService.getProfile(user.id);
      return {
        message: 'Profile retrieved',
        data: { ...profile, userType: 'ADMIN' },
      };
    } else {
      const profile = await this.customerService.getProfile(user.id);
      return {
        message: 'Profile retrieved',
        data: { ...profile, userType: 'CUSTOMER' },
      };
    }
  }

  // ─── Device management ────────────────────────────────────────
  @ApiBearerAuth('access-token')
  @Get('devices')
  @ApiOperation({ summary: 'List all active devices for current user' })
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

    return { message: 'Devices retrieved', data: devices };
  }

  @ApiBearerAuth('access-token')
  @Delete('devices/:deviceDbId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout a specific device by its DB ID' })
  async revokeDevice(
    @Param('deviceDbId') deviceDbId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const ownerWhere =
      user.type === 'ADMIN' ? { adminId: user.id } : { customerId: user.id };

    const device = await this.prisma.device.findFirst({
      where: { id: deviceDbId, ...ownerWhere },
    });

    if (!device) return { message: 'Device not found', data: null };

    await this.tokenService.revokeDeviceTokens(deviceDbId, 'DEVICE_LOGOUT');
    return { message: 'Device logged out', data: null };
  }
}
