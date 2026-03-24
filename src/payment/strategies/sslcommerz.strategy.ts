import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutSession, Prisma } from '@prisma/client';
import {
  IPaymentStrategy,
  InitiatePaymentResult,
  CallbackResult,
} from './payment-strategy.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../../order/order.service';

@Injectable()
export class SslcommerzStrategy implements IPaymentStrategy {
  private readonly logger = new Logger(SslcommerzStrategy.name);

  private readonly SANDBOX_INIT_URL =
    'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
  private readonly SANDBOX_VALIDATE_URL =
    'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
  // For production, use:
  // private readonly INIT_URL = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
  // private readonly VALIDATE_URL = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly orderSvc: OrderService,
  ) {}

  private get storeId() {
    return this.config.get<string>('SSLCOMMERZ_STORE_ID', 'testbox');
  }
  private get storePass() {
    return this.config.get<string>('SSLCOMMERZ_STORE_PASS', 'qwerty');
  }
  private get appUrl() {
    return this.config.get<string>('APP_URL', 'http://localhost:3001');
  }
  private get frontUrl() {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  async initiate(
    session: CheckoutSession,
    customerPhone: string,
    customerEmail: string,
  ): Promise<InitiatePaymentResult> {
    const tranId = `ORDER-${session.id}-${Date.now()}`;
    const total = parseFloat(session.total.toString());

    const params = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePass,
      total_amount: total.toFixed(2),
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${this.appUrl}/api/v2/payment/sslcommerz/success`,
      fail_url: `${this.appUrl}/api/v2/payment/sslcommerz/fail`,
      cancel_url: `${this.appUrl}/api/v2/payment/sslcommerz/cancel`,
      ipn_url: `${this.appUrl}/api/v2/payment/sslcommerz/ipn`,
      cus_name: 'Customer',
      cus_email: customerEmail || 'customer@example.com',
      cus_phone: customerPhone,
      cus_add1: 'Bangladesh',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      ship_name: 'Customer',
      ship_add1: 'Bangladesh',
      ship_city: 'Dhaka',
      ship_country: 'Bangladesh',
      product_name: 'E-commerce Order',
      product_category: 'General',
      product_profile: 'general',
    });

    const response = await fetch(this.SANDBOX_INIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException('SSLCommerz API request failed');
    }

    const data = await response.json();

    if (data.status !== 'SUCCESS') {
      this.logger.error('SSLCommerz init failed:', data);
      throw new BadRequestException(
        data.failedreason ?? 'Payment initiation failed',
      );
    }

    // Store gateway ref (tran_id) in checkout session
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        gatewayRef: tranId,
        gatewayResponse: data as Prisma.InputJsonValue,
      },
    });

    return {
      paymentUrl: data.GatewayPageURL,
      gatewayRef: tranId,
    };
  }

  async handleCallback(payload: Record<string, any>): Promise<CallbackResult> {
    const { tran_id, val_id, status } = payload;

    if (status !== 'VALID' && status !== 'VALIDATED') {
      return { success: false, message: `Payment status: ${status}` };
    }

    // Validate transaction with SSLCommerz
    const isValid = await this.validateTransaction(val_id);
    if (!isValid) {
      this.logger.warn(`SSLCommerz validation failed for val_id=${val_id}`);
      return { success: false, message: 'Transaction validation failed' };
    }

    // Find the checkout session by gatewayRef (tran_id)
    const session = await this.prisma.checkoutSession.findFirst({
      where: { gatewayRef: tran_id },
    });

    if (!session) {
      return { success: false, message: 'Checkout session not found' };
    }

    if (session.orderId) {
      // Idempotent — already processed
      return {
        success: true,
        orderId: session.orderId,
        message: 'Order already created',
      };
    }

    // Create order
    try {
      const order = await this.orderSvc.createFromSession(
        session.id,
        session.customerId ?? undefined,
      );

      // Mark session as PAID
      await this.prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'PAID',
          gatewayResponse: payload as Prisma.InputJsonValue,
        },
      });

      // Update transaction payment status
      await this.prisma.transaction.updateMany({
        where: { orderId: order.id },
        data: {
          paymentStatus: 'COMPLETED',
          paidAt: new Date(),
          reference: val_id,
          gatewayResponse: payload as Prisma.InputJsonValue,
        },
      });

      // Update order payment status
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'COMPLETED' },
      });

      return { success: true, orderId: order.id, transactionId: val_id };
    } catch (err) {
      this.logger.error('Order creation after payment failed:', err);
      return { success: false, message: 'Order creation failed after payment' };
    }
  }

  private async validateTransaction(valId: string): Promise<boolean> {
    try {
      const url = new URL(this.SANDBOX_VALIDATE_URL);
      url.searchParams.set('val_id', valId);
      url.searchParams.set('store_id', this.storeId);
      url.searchParams.set('store_passwd', this.storePass);
      url.searchParams.set('format', 'json');

      const res = await fetch(url.toString());
      const data = await res.json();
      return data.status === 'VALID' || data.status === 'VALIDATED';
    } catch {
      return false;
    }
  }
}
