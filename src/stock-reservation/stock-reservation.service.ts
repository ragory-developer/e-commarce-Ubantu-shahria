import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus } from '@prisma/client';

export interface ReserveInput {
  productId: string;
  productVariantId?: string | null;
  qty: number;
  sessionId?: string;
  customerId?: string;
  expiresInMinutes?: number;
}

export interface AvailabilityResult {
  available: boolean;
  freeQty?: number;
  reason?: string;
}

@Injectable()
export class StockReservationService {
  static readonly DEFAULT_TTL = 15; // minutes
  private readonly logger = new Logger(StockReservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Availability check ──────────────────────────────────────
  async checkAvailability(
    productId: string,
    variantId: string | null,
    qty: number,
  ): Promise<AvailabilityResult> {
    if (variantId) {
      const v = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId, deletedAt: null, isActive: true },
        select: {
          manageStock: true,
          qty: true,
          reservedQty: true,
          inStock: true,
        },
      });
      if (!v) return { available: false, reason: 'Variant not found' };
      if (!v.inStock) return { available: false, reason: 'Out of stock' };
      if (v.manageStock && v.qty != null) {
        const free = v.qty - v.reservedQty;
        if (free < qty)
          return {
            available: false,
            freeQty: Math.max(0, free),
            reason: `Only ${Math.max(0, free)} available`,
          };
      }
    } else {
      const p = await this.prisma.product.findFirst({
        where: { id: productId, deletedAt: null, isActive: true },
        select: { manageStock: true, qty: true, inStock: true },
      });
      if (!p)
        return { available: false, reason: 'Product not found or inactive' };
      if (!p.inStock) return { available: false, reason: 'Out of stock' };
      if (p.manageStock && p.qty != null) {
        if (p.qty < qty)
          return {
            available: false,
            freeQty: p.qty,
            reason: `Only ${p.qty} available`,
          };
      }
    }
    return { available: true };
  }

  // ── Validate multiple cart items at once ────────────────────
  async validateItems(
    items: Array<{ productId: string; variantId?: string | null; qty: number }>,
  ): Promise<{
    valid: boolean;
    errors: Array<{
      productId: string;
      variantId?: string | null;
      message: string;
    }>;
  }> {
    const results = await Promise.all(
      items.map(async (item) => {
        const check = await this.checkAvailability(
          item.productId,
          item.variantId ?? null,
          item.qty,
        );
        if (!check.available)
          return {
            productId: item.productId,
            variantId: item.variantId ?? null,
            message: check.reason!,
          };
        return null;
      }),
    );
    const errors = results.filter(Boolean) as Array<{
      productId: string;
      variantId: string | null;
      message: string;
    }>;
    return { valid: errors.length === 0, errors };
  }

  // ── Reserve ─────────────────────────────────────────────────
  async reserve(
    input: ReserveInput,
  ): Promise<{ success: boolean; reservationId?: string; message?: string }> {
    const check = await this.checkAvailability(
      input.productId,
      input.productVariantId ?? null,
      input.qty,
    );
    if (!check.available) return { success: false, message: check.reason };

    const expiresAt = new Date(
      Date.now() +
        (input.expiresInMinutes ?? StockReservationService.DEFAULT_TTL) *
          60_000,
    );

    const res = await this.prisma.$transaction(async (tx) => {
      const r = await tx.stockReservation.create({
        data: {
          productId: input.productId,
          productVariantId: input.productVariantId ?? null,
          customerId: input.customerId ?? null,
          sessionId: input.sessionId ?? null,
          qty: input.qty,
          status: ReservationStatus.ACTIVE,
          expiresAt,
        },
        select: { id: true },
      });

      if (input.productVariantId) {
        await tx.productVariant.update({
          where: { id: input.productVariantId },
          data: { reservedQty: { increment: input.qty } },
        });
      }
      return r;
    });

    return { success: true, reservationId: res.id };
  }

  // ── Release (cancel/expire) ──────────────────────────────────
  async release(reservationId: string): Promise<void> {
    const res = await this.prisma.stockReservation.findFirst({
      where: { id: reservationId, status: ReservationStatus.ACTIVE },
      select: { id: true, productVariantId: true, qty: true },
    });
    if (!res) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELED, releasedAt: new Date() },
      });
      if (res.productVariantId) {
        await tx.productVariant.updateMany({
          where: { id: res.productVariantId, reservedQty: { gte: res.qty } },
          data: { reservedQty: { decrement: res.qty } },
        });
      }
    });
  }

  // ── Release all for a session (checkout abandoned) ───────────
  async releaseBySession(sessionId: string): Promise<void> {
    const list = await this.prisma.stockReservation.findMany({
      where: { sessionId, status: ReservationStatus.ACTIVE },
      select: { id: true },
    });
    await Promise.all(list.map((r) => this.release(r.id)));
  }

  // ── Convert to confirmed (order placed) ─────────────────────
  async convert(reservationId: string, orderId: string): Promise<void> {
    const res = await this.prisma.stockReservation.findFirst({
      where: { id: reservationId, status: ReservationStatus.ACTIVE },
      select: { id: true, productId: true, productVariantId: true, qty: true },
    });
    if (!res) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.stockReservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CONVERTED,
          convertedAt: new Date(),
          orderId,
        },
      });
      if (res.productVariantId) {
        const before = await tx.productVariant.findUnique({
          where: { id: res.productVariantId },
          select: { qty: true, reservedQty: true, sku: true },
        });
        await tx.productVariant.update({
          where: { id: res.productVariantId },
          data: {
            qty: { decrement: res.qty },
            reservedQty: { decrement: res.qty },
          },
        });
        // Audit log
        await tx.inventoryLog.create({
          data: {
            productId: res.productId,
            productVariantId: res.productVariantId,
            sku: before?.sku ?? null,
            orderId,
            reason: 'ORDER_PLACED',
            qtyBefore: before?.qty ?? 0,
            qtyChange: -res.qty,
            qtyAfter: (before?.qty ?? 0) - res.qty,
          },
        });
      }
    });
  }

  // ── Bulk release expired (called by CleanupTask) ─────────────
  async releaseExpired(): Promise<number> {
    const expired = await this.prisma.stockReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      select: { id: true, productVariantId: true, qty: true },
    });
    if (!expired.length) return 0;

    // Group by variantId → one update per variant
    const variantDeltas = new Map<string, number>();
    for (const r of expired) {
      if (r.productVariantId) {
        variantDeltas.set(
          r.productVariantId,
          (variantDeltas.get(r.productVariantId) ?? 0) + r.qty,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stockReservation.updateMany({
        where: { id: { in: expired.map((r) => r.id) } },
        data: { status: ReservationStatus.EXPIRED, releasedAt: new Date() },
      });
      for (const [variantId, delta] of variantDeltas) {
        await tx.productVariant.updateMany({
          where: { id: variantId, reservedQty: { gte: delta } },
          data: { reservedQty: { decrement: delta } },
        });
      }
    });

    this.logger.log(`Released ${expired.length} expired reservations`);
    return expired.length;
  }
}
