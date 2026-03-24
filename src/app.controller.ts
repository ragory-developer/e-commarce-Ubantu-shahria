/**
 * APP CONTROLLER
 *
 * Root controller for health checks and basic endpoints.
 */

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /api/v2/
   * Health check endpoint
   */
  @Public() // No auth required
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  /**
   * GET /api/v2/health
   * Detailed health check
   */
  @Public()
  @Get('health')
  getDetailedHealth() {
    return this.appService.getDetailedHealth();
  }
}
