/**
 * src/otp/email-otp.service.ts
 *
 * Email OTP service - sends OTP via email using Nodemailer.
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { OtpService } from './otp.service';
import { OTP_CONFIG, OTP_ERROR } from './otp.constants';
import {
  SendOtpOptions,
  SendOtpResult,
  VerifyOtpOptions,
  VerifyOtpResult,
} from './otp.types';

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private transporter!: nodemailer.Transporter;

  constructor(
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
  ) {
    this.initializeTransporter();
  }

  // ─── Initialize Nodemailer ───────────────────────────────────
  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<boolean>('EMAIL_SECURE') ?? false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  // ─── Get Email Subject by Purpose ────────────────────────────
  private getSubject(purpose: OtpPurpose): string {
    const subjects: Record<OtpPurpose, string> = {
      VERIFY_EMAIL: 'Verify Your Email Address',
      VERIFY_PHONE: 'Phone Verification Code',
      RESET_PASSWORD: 'Password Reset Code',
      LOGIN_OTP: 'Your Login Code',
      REGISTER_ACCOUNT: 'Complete Your Registration',
    };
    return subjects[purpose] ?? 'Verification Code';
  }

  // ─── Generate HTML Email Template ────────────────────────────
  private generateEmailHtml(
    code: string,
    purpose: OtpPurpose,
    recipientName: string,
    expiryMinutes: number,
  ): string {
    const purposeTexts: Record<OtpPurpose, { title: string; action: string }> =
      {
        VERIFY_EMAIL: {
          title: 'Verify Your Email',
          action: 'verify your email address',
        },
        VERIFY_PHONE: {
          title: 'Phone Verification',
          action: 'verify your phone number',
        },
        RESET_PASSWORD: {
          title: 'Reset Your Password',
          action: 'reset your password',
        },
        LOGIN_OTP: {
          title: 'Login Verification',
          action: 'log in to your account',
        },
        REGISTER_ACCOUNT: {
          title: 'Complete Registration',
          action: 'complete your registration',
        },
      };

    const { title, action } = purposeTexts[purpose] ?? {
      title: 'Verification',
      action: 'complete verification',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">${title}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${recipientName || 'there'},
              </p>

              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Use the following code to ${action}:
              </p>

              <!-- OTP Code Box -->
              <div style="background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                <div style="font-size: 42px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${code}
                </div>
              </div>

              <!-- Expiry Warning -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 0 0 30px 0;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  ⏱️ This code will expire in <strong>${expiryMinutes} minutes</strong>.
                </p>
              </div>

              <!-- Security Warning -->
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
                🔒 <strong>Security tip:</strong> Never share this code with anyone. We will never ask for your verification code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 12px; margin: 0;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  // ─── Generate Plain Text Email ───────────────────────────────
  private generateEmailText(
    code: string,
    purpose: OtpPurpose,
    recipientName: string,
    expiryMinutes: number,
  ): string {
    const purposeTexts: Record<OtpPurpose, string> = {
      VERIFY_EMAIL: 'verify your email address',
      VERIFY_PHONE: 'verify your phone number',
      RESET_PASSWORD: 'reset your password',
      LOGIN_OTP: 'log in to your account',
      REGISTER_ACCOUNT: 'complete your registration',
    };

    const action = purposeTexts[purpose] ?? 'complete verification';

    return `
Hi ${recipientName || 'there'},

Your verification code is: ${code}

Use this code to ${action}.

This code will expire in ${expiryMinutes} minutes.

Security tip: Never share this code with anyone.

If you didn't request this code, please ignore this email.
    `.trim();
  }

  // ─── Send OTP via Email ──────────────────────────────────────
  async sendOtp(options: SendOtpOptions): Promise<SendOtpResult> {
    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(
      options.target,
      options.purpose,
    );
    if (!rateLimit.allowed) {
      return {
        success: false,
        maskedTarget: this.otpService.maskTarget(options.target, 'EMAIL'),
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
        maskedTarget: this.otpService.maskTarget(options.target, 'EMAIL'),
        expiresInSeconds: 0,
        resendAfterSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS,
        message: OTP_ERROR.COOLDOWN,
      };
    }

    // Generate and hash OTP
    const code = this.otpService.generateCode();
    const codeHash = await this.otpService.hashCode(code);

    // Store OTP in database
    await this.otpService.storeOtp('EMAIL', options, codeHash);

    // Send email
    const expirySeconds = OTP_CONFIG.EXPIRY_SECONDS[options.purpose] ?? 300;
    const expiryMinutes = Math.floor(expirySeconds / 60);

    try {
      await this.transporter.sendMail({
        from: `"${this.configService.get<string>('EMAIL_FROM_NAME')}" <${this.configService.get<string>('EMAIL_FROM_ADDRESS')}>`,
        to: options.target,
        subject: this.getSubject(options.purpose),
        text: this.generateEmailText(
          code,
          options.purpose,
          options.recipientName ?? '',
          expiryMinutes,
        ),
        html: this.generateEmailHtml(
          code,
          options.purpose,
          options.recipientName ?? '',
          expiryMinutes,
        ),
      });

      this.logger.log(
        `Email OTP sent to ${this.otpService.maskTarget(options.target, 'EMAIL')}`,
      );

      return {
        success: true,
        maskedTarget: this.otpService.maskTarget(options.target, 'EMAIL'),
        expiresInSeconds: expirySeconds,
        resendAfterSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS,
      };
    } catch (error) {
      this.logger.error('Failed to send email OTP', error);
      throw new InternalServerErrorException(
        'Failed to send verification email',
      );
    }
  }

  // ─── Verify OTP ──────────────────────────────────────────────
  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    return this.otpService.verifyOtp(options);
  }
}
