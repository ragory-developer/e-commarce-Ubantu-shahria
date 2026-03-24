import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenService } from '../auth/token.service';
import { OtpService } from '../otp/otp.service';
import { StockReservationService } from '../stock-reservation/stock-reservation.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly stockReservationService: StockReservationService,
    private readonly prisma: PrismaService,
  ) {}

  //! ================= TOKEN CLEANUP =================
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredTokens() {
    try {
      this.logger.log('Running token cleanup...');
      const count = await this.tokenService.cleanupExpiredTokens();
      this.logger.log(`Cleaned ${count} expired tokens`);
    } catch (error: unknown) {
      this.logger.error(
        'Token cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  //! ================= OTP CLEANUP =================
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    try {
      const count = await this.otpService.cleanupExpiredOtps();
      if (count > 0) {
        this.logger.log(`Cleaned ${count} expired OTPs`);
      }
    } catch (error: unknown) {
      this.logger.error(
        'OTP cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  //! ================= STOCK RESERVATION CLEANUP =================
  @Cron('*/5 * * * *')
  async cleanupExpiredReservations() {
    try {
      this.logger.log('Checking expired stock reservations...');
      const released = await this.stockReservationService.releaseExpired();

      if (released > 0) {
        this.logger.log(`Released ${released} expired stock reservations`);
      }
    } catch (error: unknown) {
      this.logger.error(
        'Stock reservation cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  //! ================= FLASH SALE STATUS =================
  @Cron('* * * * *')
  async updateFlashSaleStatuses() {
    try {
      const now = new Date();

      // Activate scheduled sales
      const activated = await this.prisma.flashSale.updateMany({
        where: {
          status: 'SCHEDULED',
          startTime: { lte: now },
          deletedAt: null,
        },
        data: { status: 'ACTIVE' },
      });

      // End expired sales
      const ended = await this.prisma.flashSale.updateMany({
        where: {
          status: 'ACTIVE',
          endTime: { lt: now },
          deletedAt: null,
        },
        data: {
          status: 'ENDED',
          isActive: false,
        },
      });

      if (activated.count > 0 || ended.count > 0) {
        this.logger.log(
          `FlashSale अपडेट → Activated: ${activated.count}, Ended: ${ended.count}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        'Flash sale update failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
