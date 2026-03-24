import {
  Injectable,
  BadRequestException,
  // NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, WalletTransactionType } from '@prisma/client';

export interface WalletCreditInput {
  customerId: string;
  amount: number;
  type:
    | 'CREDIT_CASHBACK'
    | 'CREDIT_REFUND'
    | 'CREDIT_ADJUSTMENT'
    | 'CREDIT_REFERRAL';
  orderId?: string;
  returnId?: string;
  referenceId?: string;
  description?: string;
  createdBy?: string;
}

export interface WalletDebitInput {
  customerId: string;
  amount: number;
  type: 'DEBIT_ORDER' | 'DEBIT_ADJUSTMENT' | 'DEBIT_EXPIRED';
  orderId?: string;
  referenceId?: string;
  description?: string;
  createdBy?: string;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Get or lazily create wallet ──────────────────────────────
  async getOrCreate(customerId: string) {
    return this.prisma.wallet.upsert({
      where: { customerId },
      create: { customerId, balance: 0, isActive: true },
      update: {},
    });
  }

  // ── Balance check ────────────────────────────────────────────
  async getBalance(customerId: string): Promise<number> {
    const w = await this.prisma.wallet.findUnique({
      where: { customerId },
      select: { balance: true, isActive: true },
    });
    if (!w || !w.isActive) return 0;
    return w.balance.toNumber();
  }

  async canDebit(customerId: string, amount: number): Promise<boolean> {
    const bal = await this.getBalance(customerId);
    return bal >= amount;
  }

  // ── Credit ───────────────────────────────────────────────────
  async credit(
    input: WalletCreditInput,
  ): Promise<{ newBalance: number; txId: string }> {
    const wallet = await this.getOrCreate(input.customerId);
    const newBalance = wallet.balance.toNumber() + input.amount;

    const [, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Prisma.Decimal(newBalance) },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: input.type as WalletTransactionType,
          amount: new Prisma.Decimal(input.amount),
          balance: new Prisma.Decimal(newBalance),
          orderId: input.orderId ?? null,
          returnId: input.returnId ?? null,
          referenceId: input.referenceId ?? null,
          description: input.description ?? null,
          createdBy: input.createdBy ?? null,
        },
      }),
    ]);

    this.logger.log(
      `Wallet +${input.amount} [${input.type}] customer=${input.customerId}`,
    );
    return { newBalance, txId: tx.id };
  }

  // ── Debit ────────────────────────────────────────────────────
  async debit(
    input: WalletDebitInput,
  ): Promise<{ newBalance: number; txId: string }> {
    const wallet = await this.getOrCreate(input.customerId);
    if (!wallet.isActive) throw new BadRequestException('Wallet is disabled');

    const current = wallet.balance.toNumber();
    if (current < input.amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Have: ${current}, need: ${input.amount}`,
      );
    }
    const newBalance = current - input.amount;

    const [, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Prisma.Decimal(newBalance) },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: input.type as WalletTransactionType,
          amount: new Prisma.Decimal(-input.amount), // negative = debit
          balance: new Prisma.Decimal(newBalance),
          orderId: input.orderId ?? null,
          referenceId: input.referenceId ?? null,
          description: input.description ?? null,
          createdBy: input.createdBy ?? null,
        },
      }),
    ]);

    this.logger.log(
      `Wallet -${input.amount} [${input.type}] customer=${input.customerId}`,
    );
    return { newBalance, txId: tx.id };
  }
}
