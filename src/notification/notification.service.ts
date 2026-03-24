import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter!: nodemailer.Transporter;
  private readonly smsApiKey: string;
  private readonly smsSenderId: string;
  private readonly smsBaseUrl: string;
  private readonly emailFrom: string;
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.smsApiKey = config.get('SMS_API_KEY', '');
    this.smsSenderId = config.get('SMS_SENDER_ID', 'Store');
    this.smsBaseUrl = config.get('SMS_BASE_URL', '');
    this.emailFrom = config.get('EMAIL_FROM_ADDRESS', 'noreply@example.com');
    this.appName = config.get('APP_NAME', 'Our Store');

    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('EMAIL_HOST');
    const port = this.config.get<number>('EMAIL_PORT');
    const user = this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('EMAIL_PASSWORD');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: this.config.get<boolean>('EMAIL_SECURE', false),
        auth: { user, pass },
      });
    } else {
      this.logger.warn('Email not configured — notifications will be SMS-only');
    }
  }

  // ── Order Confirmation ──────────────────────────────────────────
  async sendOrderConfirmation(orderId: string, phone: string, email?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: {
        orderNumber: true,
        total: true,
        paymentMethod: true,
        customerFirstName: true,
        status: true,
        products: { select: { productName: true, qty: true, lineTotal: true } },
      },
    });
    if (!order) return;

    const itemList = order.products
      .map((p) => `${p.productName} x${p.qty}`)
      .join(', ');

    const smsText =
      `${this.appName}: Order #${order.orderNumber} confirmed! ` +
      `Total: ৳${order.total} (${order.paymentMethod}). Items: ${itemList.substring(0, 80)}. Thank you!`;

    await Promise.allSettled([
      this.sendSms(phone, smsText),
      email ? this.sendOrderEmail(email, order) : Promise.resolve(),
    ]);
  }

  // ── Order Status Update ─────────────────────────────────────────
  async sendOrderStatusUpdate(
    orderId: string,
    status: OrderStatus,
    phone: string,
    email?: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: { orderNumber: true, trackingNumber: true, courierName: true },
    });
    if (!order) return;

    const messages: Record<string, string> = {
      CONFIRMED: `Order #${order.orderNumber} confirmed and being prepared.`,
      PROCESSING: `Order #${order.orderNumber} is being packed.`,
      SHIPPED:
        `Order #${order.orderNumber} shipped${order.courierName ? ` via ${order.courierName}` : ''}` +
        `${order.trackingNumber ? ` | Tracking: ${order.trackingNumber}` : ''}.`,
      DELIVERED: `Order #${order.orderNumber} delivered. Thank you for shopping with ${this.appName}!`,
      CANCELED: `Order #${order.orderNumber} has been cancelled. Contact support if you have questions.`,
    };

    const smsText =
      messages[status] ??
      `Order #${order.orderNumber} status updated to ${status}.`;

    await this.sendSms(phone, `${this.appName}: ${smsText}`).catch((err) =>
      this.logger.error('SMS notification failed', err),
    );
  }

  // ── Private: SMS ────────────────────────────────────────────────
  private async sendSms(phone: string, message: string) {
    if (!this.smsApiKey || !this.smsBaseUrl) {
      this.logger.debug(`[DEV SMS] To ${phone}: ${message}`);
      return;
    }

    const formatted = phone.startsWith('0') ? '880' + phone.slice(1) : phone;

    const url = new URL(`${this.smsBaseUrl}/api/sms/send`);
    url.searchParams.set('apiKey', this.smsApiKey);
    url.searchParams.set('contactNumbers', formatted);
    url.searchParams.set('senderId', this.smsSenderId);
    url.searchParams.set('textBody', message);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok)
        this.logger.warn(`SMS API returned ${res.status} for ${formatted}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Private: Email ──────────────────────────────────────────────
  private async sendOrderEmail(email: string, order: any) {
    if (!this.transporter) return;

    const html = `
      <h2>Order Confirmation — #${order.orderNumber}</h2>
      <p>Hi ${order.customerFirstName}, thank you for your order!</p>
      <h3>Order Summary</h3>
      <ul>${order.products.map((p: any) => `<li>${p.productName} × ${p.qty} — ৳${p.lineTotal}</li>`).join('')}</ul>
      <p><strong>Total: ৳${order.total}</strong></p>
      <p>Payment: ${order.paymentMethod}</p>
      <p>We'll notify you when your order is shipped.</p>
      <p>— ${this.appName}</p>
    `;

    await this.transporter
      .sendMail({
        from: `"${this.appName}" <${this.emailFrom}>`,
        to: email,
        subject: `Order Confirmed — #${order.orderNumber}`,
        html,
      })
      .catch((err) => this.logger.error('Email send failed', err));
  }
}
