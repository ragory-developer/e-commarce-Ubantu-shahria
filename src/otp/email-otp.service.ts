/**
 * src/otp/email-otp.service.ts
 *
 * Email OTP service with professional HTML templates and complete verification flow
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpChannel } from '@prisma/client';
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
  private readonly appName: string;
  private readonly supportEmail: string;

  constructor(
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'YourApp');
    this.supportEmail = this.configService.get<string>(
      'SUPPORT_EMAIL',
      'support@yourapp.com',
    );
    this.initializeTransporter();
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * INITIALIZATION
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Initialize Nodemailer transporter
   */
  private initializeTransporter(): void {
    const emailHost = this.configService.get<string>('EMAIL_HOST');
    const emailPort = this.configService.get<number>('EMAIL_PORT');
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

    if (!emailHost || !emailPort || !emailUser || !emailPassword) {
      this.logger.warn(
        'Email configuration incomplete. Email OTP will not work.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: this.configService.get<boolean>('EMAIL_SECURE') ?? true,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Test connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('Email transporter error:', error);
      } else {
        this.logger.log('Email transporter is ready');
      }
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * EMAIL TEMPLATE GENERATION
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Get email subject based on OTP purpose
   */
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

  /**
   * Generate professional HTML email template
   */
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .email-container {
      width: 100%;
      background-color: #f5f5f5;
      padding: 20px;
    }
    .email-content {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .body {
      padding: 40px 30px;
    }
    .greeting {
      color: #333;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .description {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 30px 0;
    }
    .code-container {
      background-color: #f8f9fa;
      border: 2px dashed #667eea;
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      margin: 0 0 30px 0;
    }
    .code {
      font-size: 42px;
      font-weight: bold;
      color: #667eea;
      letter-spacing: 8px;
      font-family: 'Courier New', 'Courier', monospace;
      margin: 0;
      text-align: center;
    }
    .code-subtitle {
      color: #999;
      font-size: 12px;
      margin-top: 10px;
      letter-spacing: normal;
    }
    .expiry-warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 0 0 30px 0;
      border-radius: 4px;
    }
    .expiry-warning p {
      color: #856404;
      font-size: 14px;
      margin: 0;
      line-height: 1.6;
    }
    .security-tip {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
    }
    .security-tip strong {
      color: #333;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer-text {
      color: #6c757d;
      font-size: 12px;
      margin: 0;
      line-height: 1.6;
    }
    .footer-links {
      color: #667eea;
      text-decoration: none;
      font-size: 12px;
    }
    .footer-links:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-content">
      <!-- Header -->
      <div class="header">
        <h1>${title}</h1>
      </div>

      <!-- Body -->
      <div class="body">
        <p class="greeting">Hi ${recipientName || 'there'},</p>

        <p class="description">
          Use the following code to ${action}:
        </p>

        <!-- OTP Code Box -->
        <div class="code-container">
          <div class="code">${code}</div>
          <div class="code-subtitle">Enter this code in your application</div>
        </div>

        <!-- Expiry Warning -->
        <div class="expiry-warning">
          <p>
            ⏱️ This code will expire in <strong>${expiryMinutes} minutes</strong>.
            Please use it as soon as possible.
          </p>
        </div>

        <!-- Security Warning -->
        <p class="security-tip">
          🔒 <strong>Security tip:</strong> Never share this code with anyone.
          ${this.appName} support staff will never ask you for your verification code.
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">
          © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
        </p>
        <p class="footer-text">
          Need help? <a href="mailto:${this.supportEmail}" class="footer-links">Contact Support</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email
   */
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

SECURITY NOTICE:
- Never share this code with anyone
- ${this.appName} support will never ask for your verification code
- If you didn't request this code, you can safely ignore this email

---
${this.appName} Support
${this.supportEmail}
© ${new Date().getFullYear()} ${this.appName}
    `.trim();
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * SEND OTP
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Send OTP via email
   */
  async sendOtp(options: SendOtpOptions): Promise<SendOtpResult> {
    try {
      // Validate email format
      this.otpService.validateTargetFormat(options.target, 'EMAIL');

      // Check rate limit
      const rateLimit = await this.otpService.checkRateLimit(
        options.target,
        options.purpose,
      );
      if (!rateLimit.allowed) {
        return {
          success: false,
          channel: 'EMAIL',
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
          channel: 'EMAIL',
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

      // Prepare email
      const expirySeconds = OTP_CONFIG.EXPIRY_SECONDS[options.purpose] ?? 300;
      const expiryMinutes = Math.floor(expirySeconds / 60);

      const emailFromName = this.configService.get<string>(
        'EMAIL_FROM_NAME',
        this.appName,
      );
      const emailFromAddress =
        this.configService.get<string>('EMAIL_FROM_ADDRESS');

      if (!emailFromAddress) {
        throw new InternalServerErrorException(
          'Email sender address not configured',
        );
      }

      // Send email
      await this.transporter.sendMail({
        from: `"${emailFromName}" <${emailFromAddress}>`,
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
        `Email OTP sent to ${this.otpService.maskTarget(options.target, 'EMAIL')} (${options.purpose})`,
      );

      return {
        success: true,
        channel: 'EMAIL',
        maskedTarget: this.otpService.maskTarget(options.target, 'EMAIL'),
        expiresInSeconds: expirySeconds,
        resendAfterSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS,
      };
    } catch (error) {
      this.logger.error('Failed to send email OTP', error);
      throw new InternalServerErrorException(
        'Failed to send verification email. Please try again later.',
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * VERIFY OTP
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Verify OTP code sent via email
   */
  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    try {
      const result = await this.otpService.verifyOtp(options);

      if (result.success) {
        this.logger.log(
          `Email OTP verified for ${this.otpService.maskTarget(options.target, 'EMAIL')} (${options.purpose})`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to verify email OTP', error);
      throw new InternalServerErrorException('Failed to verify OTP');
    }
  }
}
