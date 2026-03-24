import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@ApiTags('Payment — Callbacks')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentSvc: PaymentService,
    private readonly config: ConfigService,
  ) {}

  private get frontendUrl() {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  // ─── SSLCommerz IPN (server-to-server, most reliable) ─────────
  @Post('sslcommerz/ipn')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz IPN callback (server-to-server)' })
  async sslcommerzIpn(@Body() payload: Record<string, any>) {
    await this.paymentSvc.handleSslcommerzCallback(payload);
    return 'OK'; // SSLCommerz expects plain text OK
  }

  // ─── SSLCommerz Success Redirect ───────────────────────────────
  @Post('sslcommerz/success')
  @Public()
  @ApiExcludeEndpoint()
  async sslcommerzSuccess(
    @Body() payload: Record<string, any>,
    @Res() res: Response,
  ) {
    const result = await this.paymentSvc.handleSslcommerzCallback(payload);
    const redirectUrl = result.orderId
      ? `${this.frontendUrl}/order-success?orderId=${result.orderId}`
      : `${this.frontendUrl}/payment-failed`;
    return res.redirect(302, redirectUrl);
  }

  // ─── SSLCommerz Fail Redirect ──────────────────────────────────
  @Post('sslcommerz/fail')
  @Public()
  @ApiExcludeEndpoint()
  async sslcommerzFail(
    @Body() payload: Record<string, any>,
    @Res() res: Response,
  ) {
    return res.redirect(302, `${this.frontendUrl}/payment-failed`);
  }

  // ─── SSLCommerz Cancel Redirect ────────────────────────────────
  @Post('sslcommerz/cancel')
  @Public()
  @ApiExcludeEndpoint()
  async sslcommerzCancel(
    @Body() payload: Record<string, any>,
    @Res() res: Response,
  ) {
    return res.redirect(302, `${this.frontendUrl}/checkout`);
  }
}
