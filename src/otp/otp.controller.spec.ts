/**
 * src/otp/otp.controller.ts
 *
 * OTP Controller - handles all OTP-related API endpoints
 */

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OtpService } from './otp.service';
import { EmailOtpService } from './email-otp.service';
import { PhoneOtpService } from './phone-otp.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  ResendOtpDto,
  ValidateOtpDto,
  SendOtpResponseDto,
  VerifyOtpResponseDto,
  ValidateOtpResponseDto,
  OtpStatusResponseDto,
} from './dto';
import type { RequestUser } from '../auth/auth.types';

@ApiTags('OTP - One Time Password')
@Controller('otp')
export class OtpController {
  private readonly logger = new Logger(OtpController.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly emailOtpService: EmailOtpService,
    private readonly phoneOtpService: PhoneOtpService,
  ) {}

  /**
   * ═══════════════════════════════════════════════════════════
   * SEND OTP ENDPOINTS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Send OTP - Auto-detect channel (email or SMS)
   * @public endpoint
   */
  @Post('send')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP to email or phone',
    description:
      'Sends a one-time password to the provided email or phone number. ' +
      'Channel is auto-detected. Respects rate limiting and cooldown periods.',
  })
  @ApiBody({
    type: SendOtpDto,
    examples: {
      email: {
        value: {
          target: 'user@example.com',
          purpose: 'VERIFY_EMAIL',
          recipientName: 'John Doe',
        } as SendOtpDto,
      },
      phone: {
        value: {
          target: '+8801711223344',
          purpose: 'LOGIN_OTP',
          recipientName: 'John Doe',
        } as SendOtpDto,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: SendOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or rate limit exceeded',
  })
  async sendOtp(
    @Body() dto: SendOtpDto,
  ): Promise<{ success: boolean; data: SendOtpResponseDto }> {
    try {
      // Detect channel if not specified
      const channel = dto.channel || this.otpService.detectChannel(dto.target);

      // Validate target format
      this.otpService.validateTargetFormat(dto.target, channel);

      let result;
      if (channel === 'EMAIL') {
        result = await this.emailOtpService.sendOtp({
          target: dto.target,
          purpose: dto.purpose,
          recipientName: dto.recipientName,
        });
      } else {
        result = await this.phoneOtpService.sendOtp({
          target: dto.target,
          purpose: dto.purpose,
          recipientName: dto.recipientName,
        });
      }

      this.logger.log(
        `OTP sent to ${result.maskedTarget} for purpose: ${dto.purpose}`,
      );

      return {
        success: result.success,
        data: result as SendOtpResponseDto,
      };
    } catch (error) {
      this.logger.error('Error sending OTP', error);
      throw error;
    }
  }

  /**
   * Resend OTP - with cooldown check
   * @public endpoint
   */
  @Post('resend')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP after cooldown',
    description:
      'Resend OTP code to the same target. Must wait for cooldown period ' +
      'before requesting a new code.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully',
    type: SendOtpResponseDto,
  })
  async resendOtp(
    @Body() dto: ResendOtpDto,
  ): Promise<{ success: boolean; data: SendOtpResponseDto }> {
    try {
      // Detect channel
      const channel = this.otpService.detectChannel(dto.target);
      this.otpService.validateTargetFormat(dto.target, channel);

      let result;
      if (channel === 'EMAIL') {
        result = await this.emailOtpService.sendOtp({
          target: dto.target,
          purpose: dto.purpose,
          recipientName: dto.recipientName,
        });
      } else {
        result = await this.phoneOtpService.sendOtp({
          target: dto.target,
          purpose: dto.purpose,
          recipientName: dto.recipientName,
        });
      }

      return {
        success: result.success,
        data: result as SendOtpResponseDto,
      };
    } catch (error) {
      this.logger.error('Error resending OTP', error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * VERIFY & VALIDATE OTP ENDPOINTS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Verify OTP - consumes the code
   * @public endpoint
   */
  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and consume it',
    description:
      'Verifies the OTP code and marks it as used. ' +
      'Cannot be used again after verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    type: VerifyOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or max attempts exceeded',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{ success: boolean; data: VerifyOtpResponseDto }> {
    try {
      const result = await this.otpService.verifyOtp({
        target: dto.target,
        purpose: dto.purpose,
        code: dto.code,
        consume: dto.consume !== false,
      });

      if (!result.success) {
        throw new BadRequestException(result.message);
      }

      this.logger.log(
        `OTP verified for ${this.otpService.maskTarget(dto.target, this.otpService.detectChannel(dto.target))}`,
      );

      return {
        success: result.success,
        data: {
          success: result.success,
          verified: result.verified,
          consumedAt: new Date(),
        } as VerifyOtpResponseDto,
      };
    } catch (error) {
      this.logger.error('Error verifying OTP', error);
      throw error;
    }
  }

  /**
   * Validate OTP - without consuming
   * Check if OTP is valid without marking as used
   * @public endpoint
   */
  @Post('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate OTP without consuming',
    description:
      'Checks if OTP is valid without marking it as used. ' +
      'Useful for UI validation before form submission.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP validation result',
    type: ValidateOtpResponseDto,
  })
  async validateOtp(
    @Body() dto: ValidateOtpDto,
  ): Promise<{ success: boolean; data: ValidateOtpResponseDto }> {
    try {
      const result = await this.otpService.verifyOtp({
        target: dto.target,
        purpose: dto.purpose,
        code: dto.code,
        consume: false, // Don't consume
      });

      const status = await this.otpService.getOtpStatus(
        dto.target,
        dto.purpose,
      );

      return {
        success: result.success,
        data: {
          success: result.success,
          valid: result.success,
          expiresInSeconds: status?.expiresInSeconds,
          attemptsRemaining: status?.attemptsRemaining,
        } as ValidateOtpResponseDto,
      };
    } catch (error) {
      this.logger.error('Error validating OTP', error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * STATUS & INFO ENDPOINTS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Get OTP status
   * Check status of active OTP without verifying
   * @public endpoint (rate limited)
   */
  @Get('status/:target/:purpose')
  @Public()
  @ApiOperation({
    summary: 'Get OTP status',
    description:
      'Get information about an active OTP request. ' +
      'Shows expiration time and attempts remaining.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP status retrieved',
  })
  @ApiResponse({
    status: 404,
    description: 'No active OTP found',
  })
  async getOtpStatus(
    @Body() params: { target: string; purpose: string },
  ): Promise<{
    success: boolean;
    data?: OtpStatusResponseDto;
  }> {
    try {
      const status = await this.otpService.getOtpStatus(
        params.target,
        params.purpose as any,
      );

      if (!status) {
        return {
          success: false,
        };
      }

      return {
        success: true,
        data: {
          id: status.id,
          target: this.otpService.maskTarget(
            status.target,
            this.otpService.detectChannel(status.target),
          ),
          purpose: status.purpose,
          channel: status.channel,
          verified: status.verified,
          expiresAt: status.expiresAt,
          attemptsRemaining: status.attemptsRemaining,
          createdAt: status.createdAt,
          verifiedAt: status.verifiedAt,
        } as OtpStatusResponseDto,
      };
    } catch (error) {
      this.logger.error('Error getting OTP status', error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * ADMIN ENDPOINTS (requires authentication)
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Get all active OTPs for a target (admin)
   * @requires authentication
   */
  @Get('admin/active/:target')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '[ADMIN] Get active OTPs for target',
    description:
      'Get all active OTP requests for a specific email/phone. Admin only.',
  })
  async getActiveOtps(
    @CurrentUser() user: RequestUser,
    @Body() params: { target: string },
  ): Promise<{ success: boolean; data: any[] }> {
    try {
      // Verify user is admin
      if (!user || user.role !== 'ADMIN') {
        throw new BadRequestException('Admin access required');
      }

      const otps = await this.otpService.getActiveOtps(params.target);

      return {
        success: true,
        data: otps,
      };
    } catch (error) {
      this.logger.error('Error getting active OTPs', error);
      throw error;
    }
  }

  /**
   * Force invalidate OTP (admin)
   * @requires authentication
   */
  @Post('admin/invalidate')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Force invalidate OTP',
    description:
      'Immediately expire an OTP request. Admin only. ' +
      'Use for security issues.',
  })
  async forceInvalidate(
    @CurrentUser() user: RequestUser,
    @Body() dto: { target: string; purpose: string },
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify user is admin
      if (!user || user.role !== 'ADMIN') {
        throw new BadRequestException('Admin access required');
      }

      await this.otpService.forceInvalidate(dto.target, dto.purpose as any);

      this.logger.log(
        `OTP force invalidated for ${this.otpService.maskTarget(dto.target, this.otpService.detectChannel(dto.target))}`,
      );

      return {
        success: true,
        message: 'OTP invalidated successfully',
      };
    } catch (error) {
      this.logger.error('Error force invalidating OTP', error);
      throw error;
    }
  }

  /**
   * Cleanup expired OTPs (admin)
   * @requires authentication
   */
  @Post('admin/cleanup')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Cleanup expired OTPs',
    description:
      'Delete expired OTP records from database. Admin only. Can be called by scheduled tasks.',
  })
  async cleanupExpiredOtps(
    @CurrentUser() user: RequestUser,
  ): Promise<{ success: boolean; deleted: number }> {
    try {
      // Verify user is admin (or allow from scheduled tasks)
      if (!user || user.role !== 'ADMIN') {
        throw new BadRequestException('Admin access required');
      }

      const deleted = await this.otpService.cleanupExpiredOtps();

      this.logger.log(`Cleaned up ${deleted} expired OTP records`);

      return {
        success: true,
        deleted,
      };
    } catch (error) {
      this.logger.error('Error cleaning up OTPs', error);
      throw error;
    }
  }
}
