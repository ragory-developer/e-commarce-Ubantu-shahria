import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupTask } from './cleanup.task';
import { PrismaModule } from '../prisma/prisma.module';
import { OtpModule } from '../otp/otp.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from '../auth/token.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    OtpModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('jwt.secret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [CleanupTask, TokenService],
})
export class TasksModule {}
