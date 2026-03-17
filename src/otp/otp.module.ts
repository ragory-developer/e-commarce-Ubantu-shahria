/**
 * src/otp/otp.module.ts
 *
 * OTP Module - registers all OTP services.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { OtpService } from './otp.service';
import { EmailOtpService } from './email-otp.service';
import { PhoneOtpService } from './phone-otp.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [OtpService, EmailOtpService, PhoneOtpService],
  exports: [OtpService, EmailOtpService, PhoneOtpService],
})
export class OtpModule {}
