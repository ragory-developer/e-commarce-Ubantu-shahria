import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { WalletTransactionType, Prisma } from '@prisma/client';

// ─── DTOs ─────────────────────────────────────────────────────

export class AdminWalletAdjustDto {
  @ApiProperty({ example: 100, description: 'Positive amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: ['CREDIT_ADJUSTMENT', 'DEBIT_ADJUSTMENT'] })
  @IsEnum(['CREDIT_ADJUSTMENT', 'DEBIT_ADJUSTMENT'])
  type!: 'CREDIT_ADJUSTMENT' | 'DEBIT_ADJUSTMENT';

  @ApiPropertyOptional({ example: 'Manual cashback for VIP customer' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ListWalletTxDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;
}

// ─── Service ──────────────────────────────────────────────────

@Injectable()
export class AdminWalletService {
  private readonly logger = new Logger(AdminWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async getWallet(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId },
      select: {
        id: true,
        balance: true,
        currency: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      customer,
      wallet: wallet ?? { balance: 0, currency: 'BDT', isActive: false },
    };
  }

  async getTransactions(customerId: string, dto: ListWalletTxDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!wallet)
      return { data: [], meta: { total: 0, page: dto.page, limit: dto.limit } };

    const skip = (dto.page - 1) * dto.limit;
    const [txs, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: dto.limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      data: txs,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async adjust(customerId: string, dto: AdminWalletAdjustDto, adminId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.type === 'CREDIT_ADJUSTMENT') {
      return this.walletService.credit({
        customerId,
        amount: dto.amount,
        type: 'CREDIT_ADJUSTMENT',
        description: dto.description ?? 'Admin manual credit',
        createdBy: adminId,
      });
    } else {
      const canDebit = await this.walletService.canDebit(
        customerId,
        dto.amount,
      );
      if (!canDebit)
        throw new BadRequestException(
          'Wallet balance is less than the debit amount',
        );

      return this.walletService.debit({
        customerId,
        amount: dto.amount,
        type: 'DEBIT_ADJUSTMENT',
        description: dto.description ?? 'Admin manual debit',
        createdBy: adminId,
      });
    }
  }

  async setActive(customerId: string, isActive: boolean, adminId: string) {
    const wallet = await this.walletService.getOrCreate(customerId);
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { isActive },
    });
    this.logger.log(
      `Wallet ${isActive ? 'enabled' : 'disabled'} for ${customerId} by ${adminId}`,
    );
  }
}
