// ═══════════════════════════════════════════════════════════
// PRISMA SERVICE - PRISMA V6 COMPATIBLE (COMPLETE VERSION)
// ═══════════════════════════════════════════════════════════
// Production-grade PrismaService with:
// - Soft delete extension (replaces middleware)
// - Audit extension (optional - replaces audit middleware)
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

// ─── Auditable Models Configuration ───────────────────────────
const AUDITABLE_MODELS = new Set([
  'Product',
  'ProductVariant',
  'Order',
  'Admin',
  'Customer',
  'Coupon',
  'FlashSale',
  'Brand',
  'Category',
  'Transaction',
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
    // Apply multiple extensions (soft delete + audit)
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

            (args.where as any) = {
              ...args.where,
              deletedAt: null,
            };

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

            if (!args) args = {};
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

            if (!args) args = {};
            if (!args.where) args.where = {};
            if ((args.where as any).deletedAt === undefined) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },

          // ─── DELETE Operations: Convert to UPDATE ───────────────
          async delete({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }

            // Convert delete to update with deletedAt
            return this[model].update({
              ...args,
              data: {
                deletedAt: new Date(),
              },
            });
          },

          async deleteMany({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }

            // Convert deleteMany to updateMany with deletedAt
            return this[model].updateMany({
              ...args,
              data: {
                deletedAt: new Date(),
              },
            });
          },
        },
      },
    }).$extends({
      name: 'audit',
      query: {
        $allModels: {
          // ─── Audit CREATE Operations ──────────────────────────
          async create({ model, args, query }) {
            const result = await query(args);

            if (AUDITABLE_MODELS.has(model)) {
              // Fire-and-forget audit log (don't block the request)
              setImmediate(() => {
                // TODO: Implement actual audit logging
                // Options:
                // 1. Save to audit_logs table via separate PrismaClient
                // 2. Emit event to queue (BullMQ)
                // 3. Send to external service (DataDog, Sentry)

                if (process.env.NODE_ENV === 'development') {
                  console.log('[AUDIT]', {
                    model,
                    operation: 'CREATE',
                    entityId: (result as any)?.id,
                    timestamp: new Date().toISOString(),
                  });
                }
              });
            }

            return result;
          },

          // ─── Audit UPDATE Operations ──────────────────────────
          async update({ model, args, query }) {
            const result = await query(args);

            if (AUDITABLE_MODELS.has(model)) {
              setImmediate(() => {
                if (process.env.NODE_ENV === 'development') {
                  console.log('[AUDIT]', {
                    model,
                    operation: 'UPDATE',
                    entityId: (result as any)?.id,
                    changes: args.data,
                    timestamp: new Date().toISOString(),
                  });
                }
              });
            }

            return result;
          },

          // ─── Audit DELETE Operations ──────────────────────────
          async delete({ model, args, query }) {
            const result = await query(args);

            if (AUDITABLE_MODELS.has(model)) {
              setImmediate(() => {
                if (process.env.NODE_ENV === 'development') {
                  console.log('[AUDIT]', {
                    model,
                    operation: 'DELETE',
                    entityId: (result as any)?.id,
                    timestamp: new Date().toISOString(),
                  });
                }
              });
            }

            return result;
          },
        },
      },
    }) as unknown as this;
  }

  async onModuleInit() {
    // Query logging in development
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

  // ═══════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════

  // ─── Helper: Find including soft-deleted records ───────────
  // Use when admins need to see deleted items (e.g., "Trash" view)
  withDeleted() {
    return new PrismaClient();
  }

  // ─── Helper: Restore a soft-deleted record ─────────────────
  async restore<T extends keyof PrismaClient>(
    model: T,
    id: string,
    restoredBy?: string,
  ) {
    return await (this[model] as any).update({
      where: { id, deletedAt: { not: null } },
      data: {
        deletedAt: null,
        deletedBy: null,
        restoredBy: restoredBy || null,
        updatedAt: new Date(),
      },
    });
  }

  // ─── Helper: Hard delete (permanently remove) ──────────────
  // Use with extreme caution — only for GDPR "right to be forgotten"
  async hardDelete<T extends keyof PrismaClient>(model: T, id: string) {
    const client = new PrismaClient();
    try {
      return await (client[model] as any).delete({
        where: { id },
      });
    } finally {
      await client.$disconnect();
    }
  }

  // ─── Helper: Cleanup old soft-deleted records ──────────────
  // Run via cron job: delete records soft-deleted more than X days ago
  async purgeDeletedRecords(model: string, olderThanDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const client = new PrismaClient();
    try {
      const result = await (client as any)[model].deleteMany({
        where: {
          deletedAt: {
            not: null,
            lt: cutoffDate,
          },
        },
      });
      this.logger.log(
        `Purged ${result.count} ${model} records older than ${olderThanDays} days`,
      );
      return result;
    } finally {
      await client.$disconnect();
    }
  }
}
