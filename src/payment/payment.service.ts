import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodStrategy } from './strategies/cod.strategy';
import { SslcommerzStrategy } from './strategies/sslcommerz.strategy';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codStrategy: CodStrategy,
    private readonly sslStrategy: SslcommerzStrategy,
  ) {}

  async initiateOnlinePayment(sessionId: string, customerId?: string) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id: sessionId, status: 'PENDING' },
    });

    if (!session) throw new BadRequestException('Checkout session not found');
    if (session.paymentMethod === 'COD') {
      throw new BadRequestException('Use place-order endpoint for COD');
    }

    // Get customer contact info
    let customerPhone = '';
    let customerEmail = '';

    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId },
        select: { phone: true, email: true },
      });
      customerPhone = customer?.phone ?? '';
      customerEmail = customer?.email ?? '';
    }

    const snap = session.cartSnapshot as any;
    if (snap?.guestInfo) {
      customerPhone = customerPhone || snap.guestInfo.phone;
      customerEmail = customerEmail || (snap.guestInfo.email ?? '');
    }

    switch (session.paymentMethod) {
      case 'SSLCOMMERZ':
        return this.sslStrategy.initiate(session, customerPhone, customerEmail);
      default:
        throw new BadRequestException(
          `Payment method ${session.paymentMethod} not yet integrated`,
        );
    }
  }

  async handleSslcommerzCallback(payload: Record<string, any>) {
    return this.sslStrategy.handleCallback(payload);
  }
}
