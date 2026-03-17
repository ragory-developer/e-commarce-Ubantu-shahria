/**
 * src/tasks/cleanup.task.ts
 * 1. this.cleanup() - clean up old files in the output directory
 * 2. this.cleanupCache() - clean up old files in the cache directory
 * 3. this.cleanupLogs() - clean up old files in the logs directory
 * 4. this.cleanupTemp() - clean up old files in the temp directory
 * 5. this.cleanupThumbnails() - clean up old files in the thumbnails directory
 * 6. this.cleanupPreviews() - clean up old files in the previews directory
 * 7. this.cleanupExports() - clean up old files in the exports directory
 * 8. this.cleanupBackups() - clean up old files in the backups directory
 * 9. this.cleanupArchives() - clean up old files in the archives directory
 * 10. this.cleanupReports() - clean up old files in the reports directory
 * 11. this.cleanupTempFiles() - clean up old files in the temp files directory
 * 12. this.cleanupCacheFiles() - clean up old files in the cache files directory
 */
// src/tasks/cleanup.task.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenService } from '../auth/token.service';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
  ) {}

  // Run every night at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredTokens() {
    this.logger.log('Running token cleanup...');
    const count = await this.tokenService.cleanupExpiredTokens();
    this.logger.log(`Cleaned ${count} expired tokens`);
  }

  // Run every hour
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    const count = await this.otpService.cleanupExpiredOtps();
    if (count > 0) {
      this.logger.log(`Cleaned ${count} expired OTPs`);
    }
  }
}
