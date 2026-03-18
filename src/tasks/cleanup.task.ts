import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenService } from '../auth/token.service';
import { OtpService } from '../otp/otp.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredTokens() {
    this.logger.log('Running token cleanup...');
    const count = await this.tokenService.cleanupExpiredTokens();
    this.logger.log(`Cleaned ${count} expired tokens`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    const count = await this.otpService.cleanupExpiredOtps();
    if (count > 0) this.logger.log(`Cleaned ${count} expired OTPs`);
  }

  /** Release expired stock reservations every 5 minutes */
  @Cron('*/5 * * * *')
  async cleanupExpiredReservations() {
    const result = await this.prisma.stockReservation.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
        releasedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`Released ${result.count} expired stock reservations`);
      // Log inventory for each released reservation
      // (full implementation requires iterating and updating product qty)
    }
  }

  /** Update flash sale statuses every minute */
  @Cron('* * * * *')
  async updateFlashSaleStatuses() {
    const now = new Date();

    // Activate scheduled sales whose start time has passed
    await this.prisma.flashSale.updateMany({
      where: { status: 'SCHEDULED', startTime: { lte: now }, deletedAt: null },
      data: { status: 'ACTIVE' },
    });

    // End active sales whose end time has passed
    await this.prisma.flashSale.updateMany({
      where: { status: 'ACTIVE', endTime: { lt: now }, deletedAt: null },
      data: { status: 'ENDED', isActive: false },
    });
  }
}
