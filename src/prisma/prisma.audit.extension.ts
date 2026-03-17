// ═══════════════════════════════════════════════════════════
// PRISMA V6 AUDIT EXTENSION
// ═══════════════════════════════════════════════════════════
// This extension replaces the old audit middleware.
// It automatically logs all create, update, and delete operations.

import { Prisma } from '@prisma/client';

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

// ─── Audit Extension ──────────────────────────────────────────
export const auditExtension = Prisma.defineExtension({
  name: 'audit',
  query: {
    $allModels: {
      // ─── CREATE Operations ─────────────────────────────────
      async create({ model, args, query }) {
        const result = await query(args);

        if (AUDITABLE_MODELS.has(model)) {
          // Fire-and-forget audit log (don't block the request)
          setImmediate(() => {
            // TODO: Implement audit logging
            // You can:
            // 1. Emit an event to a queue (BullMQ)
            // 2. Use a separate PrismaClient to avoid recursion
            // 3. Log to external service (DataDog, Sentry, etc.)

            console.log('[AUDIT]', {
              model,
              operation: 'CREATE',
              entityId: (result as any)?.id,
              timestamp: new Date().toISOString(),
            });
          });
        }

        return result;
      },

      // ─── UPDATE Operations ─────────────────────────────────
      async update({ model, args, query }) {
        const result = await query(args);

        if (AUDITABLE_MODELS.has(model)) {
          setImmediate(() => {
            console.log('[AUDIT]', {
              model,
              operation: 'UPDATE',
              entityId: (result as any)?.id,
              changes: args.data,
              timestamp: new Date().toISOString(),
            });
          });
        }

        return result;
      },

      // ─── DELETE Operations ─────────────────────────────────
      async delete({ model, args, query }) {
        const result = await query(args);

        if (AUDITABLE_MODELS.has(model)) {
          setImmediate(() => {
            console.log('[AUDIT]', {
              model,
              operation: 'DELETE',
              entityId: (result as any)?.id,
              timestamp: new Date().toISOString(),
            });
          });
        }

        return result;
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════
// USAGE IN PRISMA SERVICE:
// ═══════════════════════════════════════════════════════════
// import { auditExtension } from './prisma.audit.extension';
//
// return this.$extends(softDeleteExtension)
//             .$extends(auditExtension) as unknown as this;
// ═══════════════════════════════════════════════════════════
