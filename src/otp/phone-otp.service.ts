/**
 * src/otp/phone-otp.service.ts
 *
 * Phone OTP service - sends OTP via SMS using SMS API.
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { OtpService } from './otp.service';
import { OTP_CONFIG, OTP_ERROR } from './otp.constants';
import {
  SendOtpOptions,
  SendOtpResult,
  VerifyOtpOptions,
  VerifyOtpResult,
} from './otp.types';

@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger(PhoneOtpService.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Format Phone Number (add country code) ──────────────────
  private formatPhoneNumber(phone: string): string {
    // Remove any spaces, dashes, or special characters
    const cleaned = phone.replace(/[\s\-()+]/g, '');

    // If starts with 0, replace with 880 (Bangladesh)
    if (cleaned.startsWith('0')) {
      return '880' + cleaned.substring(1);
    }

    // If doesn't start with 880, add it
    if (!cleaned.startsWith('880')) {
      return '880' + cleaned;
    }

    return cleaned;
  }

  // ─── Generate SMS Message ────────────────────────────────────
  private generateSmsMessage(code: string, purpose: OtpPurpose): string {
    const expirySeconds = OTP_CONFIG.EXPIRY_SECONDS[purpose] ?? 300;
    const expiryMinutes = Math.floor(expirySeconds / 60);

    const purposeTexts: Record<OtpPurpose, string> = {
      VERIFY_PHONE: 'Phone verification',
      VERIFY_EMAIL: 'Email verification',
      RESET_PASSWORD: 'Password reset',
      LOGIN_OTP: 'Login',
      REGISTER_ACCOUNT: 'Registration',
    };

    const purposeText = purposeTexts[purpose] ?? 'Verification';

    return `${purposeText} code is: ${code}. Valid for ${expiryMinutes} mins. Do not share.`;
  }

  // ─── Send SMS via API ────────────────────────────────────────
  private async sendSms(phone: string, message: string): Promise<void> {
    const apiKey = this.configService.get<string>('SMS_API_KEY');
    const senderId = this.configService.get<string>('SMS_SENDER_ID');
    const baseUrl = this.configService.get<string>('SMS_BASE_URL');

    if (!apiKey || !senderId || !baseUrl) {
      // In development, log instead of throwing so the app still works
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn(
          `[DEV] SMS not configured — would send to ${phone}: ${message}`,
        );
        return;
      }
      throw new InternalServerErrorException('SMS configuration is incomplete');
    }

    const formattedPhone = this.formatPhoneNumber(phone);

    // Build API URL (GET request format for massdata)
    const url = new URL(`${baseUrl}/api/sms/send`);
    url.searchParams.append('apiKey', apiKey);
    url.searchParams.append('contactNumbers', formattedPhone);
    url.searchParams.append('senderId', senderId);
    url.searchParams.append('textBody', message);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`SMS API error (${response.status}): ${errorText}`);
        throw new Error(`SMS API returned ${response.status}`);
      }

      const result = await response.json();
      this.logger.debug('SMS API response:', result);
    } catch (error) {
      this.logger.error('Failed to send SMS', error);
      throw new InternalServerErrorException('Failed to send SMS verification');
    }
  }

  // ─── Send OTP via SMS ────────────────────────────────────────
  async sendOtp(options: SendOtpOptions): Promise<SendOtpResult> {
    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(
      options.target,
      options.purpose,
    );
    if (!rateLimit.allowed) {
      return {
        success: false,
        maskedTarget: this.otpService.maskTarget(options.target, 'SMS'),
        expiresInSeconds: 0,
        resendAfterSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS,
        message: OTP_ERROR.RATE_LIMIT,
      };
    }

    // Check resend cooldown
    const onCooldown = await this.otpService.checkResendCooldown(
      options.target,
      options.purpose,
    );
    if (onCooldown) {
      return {
        success: false,
        maskedTarget: this.otpService.maskTarget(options.target, 'SMS'),
        expiresInSeconds: 0,
        resendAfterSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS,
        message: OTP_ERROR.COOLDOWN,
      };
    }

    // Generate and hash OTP
    const code = this.otpService.generateCode();
    const codeHash = await this.otpService.hashCode(code);

    // Store OTP in database
    await this.otpService.storeOtp('SMS', options, codeHash);

    // Send SMS
    const message = this.generateSmsMessage(code, options.purpose);

    try {
      await this.sendSms(options.target, message);

      this.logger.log(
        `SMS OTP sent to ${this.otpService.maskTarget(options.target, 'SMS')}`,
      );

      const expirySeconds = OTP_CONFIG.EXPIRY_SECONDS[options.purpose] ?? 300;

      return {
        success: true,
        maskedTarget: this.otpService.maskTarget(options.target, 'SMS'),
        expiresInSeconds: expirySeconds,
        resendAfterSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS,
      };
    } catch (error) {
      this.logger.error('Failed to send SMS OTP', error);
      throw new InternalServerErrorException('Failed to send SMS verification');
    }
  }

  // ─── Verify OTP ──────────────────────────────────────────────
  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    return this.otpService.verifyOtp(options);
  }
}
