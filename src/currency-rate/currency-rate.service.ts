import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export class UpsertCurrencyRateDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({
    example: 110.5,
    description: 'How many BDT per 1 unit of this currency',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  rate!: number;
}

@Injectable()
export class CurrencyRateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.currencyRate.findMany({
      where: { deletedAt: null },
      orderBy: { currency: 'asc' },
    });
  }

  async findOne(currency: string) {
    const r = await this.prisma.currencyRate.findFirst({
      where: { currency: currency.toUpperCase(), deletedAt: null },
    });
    if (!r)
      throw new NotFoundException(`Currency rate for ${currency} not found`);
    return r;
  }

  async upsert(dto: UpsertCurrencyRateDto, updatedBy?: string) {
    return this.prisma.currencyRate.upsert({
      where: { currency: dto.currency.toUpperCase() },
      create: {
        currency: dto.currency.toUpperCase(),
        rate: new Prisma.Decimal(dto.rate),
      },
      update: { rate: new Prisma.Decimal(dto.rate) },
    });
  }

  async remove(currency: string, deletedBy: string): Promise<void> {
    const r = await this.findOne(currency);
    await this.prisma.softDelete('currencyRate', r.id, deletedBy);
  }

  /** Convert amount from storeCurrency to target */
  async convert(amount: number, toCurrency: string): Promise<number> {
    if (toCurrency === 'BDT') return amount;
    const rate = await this.findOne(toCurrency);
    return parseFloat((amount / rate.rate.toNumber()).toFixed(4));
  }
}
