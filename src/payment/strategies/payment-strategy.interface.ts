import { CheckoutSession } from '@prisma/client';

export interface InitiatePaymentResult {
  paymentUrl?: string; // Redirect URL for online payments
  gatewayRef?: string; // SSLCommerz session key / bKash txnID
  meta?: Record<string, any>;
}

export interface CallbackResult {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  message?: string;
}

export interface IPaymentStrategy {
  /** Initiate payment and return gateway URL (for online) or null (for COD) */
  initiate(
    session: CheckoutSession,
    customerPhone: string,
    customerEmail: string,
  ): Promise<InitiatePaymentResult>;

  /** Verify a gateway callback / IPN and create/confirm order */
  handleCallback(payload: Record<string, any>): Promise<CallbackResult>;
}
