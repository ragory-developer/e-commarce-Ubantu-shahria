// ─── Prisma Service for NestJS (Prisma v6 Compatible) ────────

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// ─── Soft Delete Models Configuration ─────────────────────────
const SOFT_DELETE_MODELS = new Set([
  'Admin',
  'Customer',
  'Address',
  'Brand',
  'Category',
  'Tag',
  'Product',
  'ProductVariant',
  'AttributeSet',
  'Attribute',
  'AttributeValue',
  'Variation',
  'VariationValue',
  'Order',
  'OrderPackage',
  'OrderReturn',
  'Transaction',
  'Refund',
  'TaxClass',
  'TaxRate',
  'CurrencyRate',
  'Coupon',
  'Promotion',
  'FlashSale',
  'FlashSaleProduct',
  'Courier',
  'DeliveryZone',
  'DeliveryRider',
  'Media',
  'Review',
  'CustomerNote',
  'Setting',
  'ApiKey',
  'ProductQuestion',
  'ProductAnswer',
]);

const SOFT_DELETE_NO_BY = new Set(['ShippingRule', 'Division']);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'stdout', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
    });

    // ✅ Prisma v6 Extension (Safe)
    return this.$extends({
      name: 'softDelete',
      query: {
        $allModels: {
          async findUnique({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) return query(args);

            args.where = {
              ...args.where,
              deletedAt: null,
            } as any;

            return query(args);
          },

          async findFirst({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) return query(args);

            args.where = args.where || {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },

          async findMany({ model, args, query }) {
            const isSoftDel =
              SOFT_DELETE_MODELS.has(model) || SOFT_DELETE_NO_BY.has(model);

            if (isSoftDel) return query(args);

            args = args || {};
            args.where = args.where || {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },

          async count({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) return query(args);

            args = args || {};
            args.where = args.where || {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },
        },
      },
    }) as unknown as this;
  }

  // ══════════════════════════════════════════════════════════════
  // ✅ FIXED (NO $on)
  // ══════════════════════════════════════════════════════════════
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // ─── Soft delete helper ──────────────────────────────────────
  async softDelete(
    model: string,
    id: string,
    deletedBy?: string,
  ): Promise<void> {
    const hasDeletedBy =
      SOFT_DELETE_MODELS.has(model) && !SOFT_DELETE_NO_BY.has(model);

    await (this as any)[model].update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(deletedBy && hasDeletedBy ? { deletedBy } : {}),
      },
    });
  }

  // ─── Restore ────────────────────────────────────────────────
  async restore(model: string, id: string): Promise<void> {
    await (this as any)[model].update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  // ─── Hard delete (use carefully) ─────────────────────────────
  async hardDelete(model: string, id: string): Promise<void> {
    const client = new PrismaClient();
    try {
      await (client as any)[model].delete({ where: { id } });
    } finally {
      await client.$disconnect();
    }
  }

  // ─── Purge old records ───────────────────────────────────────
  async purgeDeletedRecords(
    model: string,
    olderThanDays: number = 90,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const client = new PrismaClient();
    try {
      const result = await (client as any)[model].deleteMany({
        where: {
          deletedAt: { not: null, lt: cutoffDate },
        },
      });

      this.logger.log(
        `Purged ${result.count} ${model} records older than ${olderThanDays} days`,
      );

      return result.count;
    } finally {
      await client.$disconnect();
    }
  }
}
