import { Injectable } from '@nestjs/common';
import { CheckoutSession } from '@prisma/client';
import {
  IPaymentStrategy,
  InitiatePaymentResult,
  CallbackResult,
} from './payment-strategy.interface';

@Injectable()
export class CodStrategy implements IPaymentStrategy {
  async initiate(_session: CheckoutSession): Promise<InitiatePaymentResult> {
    // COD needs no payment gateway — order is created directly by CheckoutController
    return {};
  }

  async handleCallback(_payload: Record<string, any>): Promise<CallbackResult> {
    // COD has no callback
    return { success: true, message: 'COD order — no callback needed' };
  }
}
