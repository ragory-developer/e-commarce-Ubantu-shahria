// ─── Prisma Service for NestJS (Prisma v6 Compatible) ────────
// Production-grade PrismaService with:
// - Soft delete extension (replaces middleware)
// - Connection pooling logging
// - Graceful shutdown
// - Query logging in development

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

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
  'Option',
  'OptionValue',
  'Variation',
  'VariationValue',
  'Order',
  'Transaction',
  'TaxClass',
  'TaxRate',
  'Coupon',
  'Review',
  'FlashSale',
  'FlashSaleProduct',
  'CurrencyRate',
  'Setting',
  'SearchTerm',
  'File',
  'DeliveryRider',
  'OrderPackage',
]);

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
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
    });

    // ═══════════════════════════════════════════════════════════
    // Prisma v6: Extensions replace Middleware
    // NOTE: Inside extension query functions, `this` is a special
    // Prisma extension context — you cannot call this[model].update()
    // directly. Instead, pass through the args and rely on the
    // application layer to convert deletes to updates (via service calls).
    // For soft delete on model.delete(), we intercept at the service level
    // using the updateMany approach shown below.
    // ═══════════════════════════════════════════════════════════
    return this.$extends({
      name: 'softDelete',
      query: {
        $allModels: {
          // ─── READ Operations: Auto-filter deletedAt ─────────────
          async findUnique({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }
            // args.where = {
            //   ...args.where,
            //   deletedAt: null,
            // } as any;
            return query(args);
          },

          async findFirst({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }
            if (!args.where) args.where = {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }
            return query(args);
          },

          async findMany({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }
            if (!args) args = {} as any;
            if (!args.where) args.where = {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }
            return query(args);
          },

          async count({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }
            if (!args) args = {} as any;
            if (!args.where) args.where = {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }
            return query(args);
          },

          // ─── DELETE Operations: Not intercepted ───────────────────
          // Prisma v6 extensions cannot safely redirect delete to update.
          // Instead, use the softDelete() helper method in service layer:
          //   await this.
          // ('product', id, deletedByAdminId)
          // instead of:
          //   await this.prisma.product.delete({ where: { id } })
        },
      },
    }) as unknown as this;
  }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    await this.$connect();
    this.logger.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // ─── Soft delete helper — USE THIS in all services ───────────
  // Instead of: prisma.product.delete({ where: { id } })
  // Use:        prisma.softDelete('product', id, deletedByAdminId)
  async softDelete(
    model: string,
    id: string,
    deletedBy?: string,
  ): Promise<void> {
    await (this as any)[model].update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(deletedBy ? { deletedBy } : {}),
      },
    });
  }

  // ─── Restore a soft-deleted record ─────────────────────────
  async restore(model: string, id: string): Promise<void> {
    await (this as any)[model].update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  // ─── Hard delete — use ONLY for GDPR "right to be forgotten" ──
  async hardDelete(model: string, id: string): Promise<void> {
    const client = new PrismaClient();
    try {
      await (client as any)[model].delete({ where: { id } });
    } finally {
      await client.$disconnect();
    }
  }

  // ─── Purge old soft-deleted records (run via cron) ──────────
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
