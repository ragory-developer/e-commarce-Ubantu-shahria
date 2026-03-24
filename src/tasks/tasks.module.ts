import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupTask } from './cleanup.task';
import { PrismaModule } from '../prisma/prisma.module';
import { OtpModule } from '../otp/otp.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from '../auth/token.service';
import { StockReservationModule } from 'src/stock-reservation/stock-reservation.module';
import { StockReservationService } from '../stock-reservation/stock-reservation.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    OtpModule,
    ConfigModule,
    StockReservationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('jwt.secret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [CleanupTask, TokenService, StockReservationService],
})
export class TasksModule {}
