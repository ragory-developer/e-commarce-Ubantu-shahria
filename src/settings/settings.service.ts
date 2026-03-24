import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export class UpsertSettingDto {
  @ApiProperty({ example: 'checkout.min_order_amount' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  key!: string;

  @ApiProperty({ example: 100 })
  value!: any;

  @ApiPropertyOptional({ example: 'checkout' })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTranslatable?: boolean;
}

// Well-known keys — all checkout-related
export const SETTING_KEYS = {
  CHECKOUT_MIN_ORDER: 'checkout.min_order_amount',
  CHECKOUT_COD_ENABLED: 'checkout.cod_enabled',
  CHECKOUT_WALLET_MAX_PERCENT: 'checkout.wallet_max_percent',
  ORDER_RETURN_WINDOW_DAYS: 'order.return_window_days',
  STORE_CURRENCY: 'store.currency',
  STORE_NAME: 'store.name',
  NOTIFICATION_SMS: 'notification.sms_enabled',
  NOTIFICATION_EMAIL: 'notification.email_enabled',
} as const;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<any> {
    const s = await this.prisma.setting.findFirst({
      where: { key, deletedAt: null },
    });
    return s ? s.value : null;
  }

  async getOrDefault(key: string, defaultValue: any): Promise<any> {
    const v = await this.get(key);
    return v !== null ? v : defaultValue;
  }

  async set(dto: UpsertSettingDto): Promise<any> {
    const setting = await this.prisma.setting.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        group: dto.group ?? null,
        value: dto.value as Prisma.InputJsonValue,
        isTranslatable: dto.isTranslatable ?? false,
      },
      update: {
        value: dto.value as Prisma.InputJsonValue,
        ...(dto.group && { group: dto.group }),
      },
    });
    this.logger.log(`Setting updated: ${dto.key}`);
    return setting;
  }

  async getGroup(group: string): Promise<Record<string, any>> {
    const settings = await this.prisma.setting.findMany({
      where: { group, deletedAt: null },
    });
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  // Public settings safe to expose to storefront
  async getPublic(): Promise<Record<string, any>> {
    const publicKeys = [
      SETTING_KEYS.STORE_NAME,
      SETTING_KEYS.STORE_CURRENCY,
      SETTING_KEYS.CHECKOUT_MIN_ORDER,
      SETTING_KEYS.CHECKOUT_COD_ENABLED,
      SETTING_KEYS.CHECKOUT_WALLET_MAX_PERCENT,
    ];
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: publicKeys }, deletedAt: null },
    });
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async list(group?: string) {
    return this.prisma.setting.findMany({
      where: { deletedAt: null, ...(group && { group }) },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async delete(key: string, deletedBy: string): Promise<void> {
    const s = await this.prisma.setting.findFirst({
      where: { key, deletedAt: null },
    });
    if (!s) throw new NotFoundException(`Setting "${key}" not found`);
    await this.prisma.softDelete('setting', s.id, deletedBy);
  }
}
