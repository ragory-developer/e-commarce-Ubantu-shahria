import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  OrderStatus,
  PackageStatus,
  CheckoutStatus,
  ReservationStatus,
} from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { CouponService } from '../coupon/coupon.service';
import { NotificationService } from '../notification/notification.service';
import { InvoiceService } from '../invoice/invoice.service';
import { CartItemSnapshot, CartSnapshot } from '../checkout/checkout.service';
import {
  AdminListOrdersDto,
  UpdateOrderStatusDto,
  CreatePackageDto,
  UpdatePackageStatusDto,
} from './dto';

// Valid order status transitions
const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELED', 'DECLINED'],
  CONFIRMED: ['PROCESSING', 'CANCELED', 'ON_HOLD'],
  PROCESSING: ['SHIPPED', 'CANCELED', 'ON_HOLD'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  ON_HOLD: ['CONFIRMED', 'CANCELED'],
  DECLINED: [],
  CANCELED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletSvc: WalletService,
    private readonly couponSvc: CouponService,
    private readonly notificationSvc: NotificationService,
    private readonly invoiceSvc: InvoiceService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE FROM CHECKOUT SESSION (ATOMIC)
  // ══════════════════════════════════════════════════════════════
  async createFromSession(
    sessionId: string,
    customerId?: string,
    notes?: string,
  ) {
    // ── Phase 1: Read session (optimistic check before TX) ─────
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id: sessionId, status: CheckoutStatus.PENDING },
    });

    if (!session) throw new NotFoundException('Checkout session not found');
    if (session.orderId) {
      // Idempotent — return existing order
      return this.prisma.order.findUniqueOrThrow({
        where: { id: session.orderId },
      });
    }
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Checkout session has expired');
    }
    if (!session.deliveryZoneId) {
      throw new BadRequestException('Delivery address not set');
    }

    const snapshot = session.cartSnapshot as unknown as CartSnapshot;
    const addressSnap = session.addressSnapshot as Record<string, any>;

    // ── Phase 2: Resolve customer info ─────────────────────────
    let customerFirstName = '';
    let customerLastName = '';
    let customerPhone = '';
    let customerEmail = '';

    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { firstName: true, lastName: true, phone: true, email: true },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      customerFirstName = customer.firstName ?? '';
      customerLastName = customer.lastName ?? '';
      customerPhone = customer.phone;
      customerEmail = customer.email ?? '';
    } else if (snapshot.guestInfo) {
      const parts = snapshot.guestInfo.fullName.split(' ');
      customerFirstName = parts[0] ?? '';
      customerLastName = parts.slice(1).join(' ');
      customerPhone = snapshot.guestInfo.phone;
      customerEmail = snapshot.guestInfo.email ?? '';
    } else {
      throw new BadRequestException('Customer information is missing');
    }

    // ── Phase 3: Resolve courier name ──────────────────────────
    let courierName: string | null = null;
    if (session.courierId) {
      const courier = await this.prisma.courier.findFirst({
        where: { id: session.courierId, deletedAt: null },
        select: { name: true },
      });
      courierName = courier?.name ?? null;
    }

    const subTotal = parseFloat(session.subTotal.toString());
    const shippingCost = parseFloat(session.shippingCost.toString());
    const discount = parseFloat(session.discount.toString());
    const total = parseFloat(session.total.toString());
    const walletUsed = parseFloat(session.walletAmountUsed.toString());

    // ── Phase 4: Atomic transaction ───────────────────────────
    const order = await this.prisma.$transaction(async (tx) => {
      // 4a: Create the Order
      const newOrder = await tx.order.create({
        data: {
          customerId: customerId ?? null,
          customerFirstName,
          customerLastName,
          customerPhone,
          customerEmail,
          shippingAddress: addressSnap as Prisma.InputJsonValue,
          billingAddress: addressSnap as Prisma.InputJsonValue,
          deliveryZoneId: session.deliveryZoneId,
          courierId: session.courierId,
          courierName,
          subTotal: new Prisma.Decimal(subTotal),
          shippingCost: new Prisma.Decimal(shippingCost),
          discount: new Prisma.Decimal(discount),
          total: new Prisma.Decimal(total),
          walletAmountUsed: new Prisma.Decimal(walletUsed),
          paymentMethod: session.paymentMethod,
          paymentStatus: 'PENDING',
          couponId: session.couponId,
          couponCode: session.couponCode,
          couponDiscountType: session.couponDiscountType,
          couponDiscountValue: session.couponDiscountValue,
          status:
            session.paymentMethod === 'COD'
              ? OrderStatus.CONFIRMED
              : OrderStatus.PENDING,
          notes: notes
            ? ({ text: notes } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          confirmedAt: session.paymentMethod === 'COD' ? new Date() : null,
        },
      });

      // 4b: Create OrderProducts
      for (const item of snapshot.items) {
        await tx.orderProduct.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            productVariantId: item.variantId,
            productName: item.productName,
            productSku: item.productSku,
            productSlug: item.productSlug,
            productImage: item.productImage
              ? (item.productImage as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            qty: item.qty,
            lineTotal: new Prisma.Decimal(item.lineTotal),
            variationsSnapshot: item.variationsSnapshot
              ? (item.variationsSnapshot as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        });
      }

      // 4c: Deduct stock + release/convert reservations (atomic)
      for (const item of snapshot.items) {
        // Convert reservation to CONVERTED state
        if (item.reservationId) {
          await tx.stockReservation.updateMany({
            where: { id: item.reservationId, status: ReservationStatus.ACTIVE },
            data: {
              status: ReservationStatus.CONVERTED,
              convertedAt: new Date(),
              orderId: newOrder.id,
            },
          });
        }

        // Deduct stock permanently
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: {
              qty: true,
              manageStock: true,
              reservedQty: true,
              sku: true,
            },
          });

          if (variant?.manageStock && variant.qty != null) {
            const qtyBefore = variant.qty;
            const qtyAfter = Math.max(0, qtyBefore - item.qty);

            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                qty: qtyAfter,
                reservedQty: {
                  decrement: Math.min(item.qty, variant.reservedQty),
                },
                inStock: qtyAfter > 0,
              },
            });

            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                productVariantId: item.variantId,
                sku: variant.sku,
                orderId: newOrder.id,
                reason: 'ORDER_PLACED',
                qtyBefore,
                qtyChange: -item.qty,
                qtyAfter,
              },
            });
          }
        } else {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { qty: true, manageStock: true, sku: true },
          });

          if (product?.manageStock && product.qty != null) {
            const qtyBefore = product.qty;
            const qtyAfter = Math.max(0, qtyBefore - item.qty);

            await tx.product.update({
              where: { id: item.productId },
              data: { qty: qtyAfter, inStock: qtyAfter > 0 },
            });

            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                sku: product.sku,
                orderId: newOrder.id,
                reason: 'ORDER_PLACED',
                qtyBefore,
                qtyChange: -item.qty,
                qtyAfter,
              },
            });
          }
        }
      }

      // 4d: Debit wallet if used
      if (walletUsed > 0 && customerId) {
        await this.walletSvc.debit({
          customerId,
          amount: walletUsed,
          type: 'DEBIT_ORDER',
          orderId: newOrder.id,
          description: `Order #${newOrder.orderNumber}`,
        });
      }

      // 4e: Create Transaction record
      await tx.transaction.create({
        data: {
          orderId: newOrder.id,
          transactionId: `TXN-${newOrder.orderNumber}-${Date.now()}`,
          paymentMethod: session.paymentMethod,
          paymentStatus:
            session.paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
          amount: new Prisma.Decimal(total),
          currency: 'BDT',
        },
      });

      // 4f: Order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          toStatus: newOrder.status,
          note:
            session.paymentMethod === 'COD'
              ? 'Order confirmed (Cash on Delivery)'
              : 'Order placed, awaiting payment',
          changedBy: customerId ?? 'SYSTEM',
        },
      });

      // 4g: Link session to order + update status
      await tx.checkoutSession.update({
        where: { id: sessionId },
        data: {
          orderId: newOrder.id,
          status:
            session.paymentMethod === 'COD'
              ? CheckoutStatus.PENDING
              : CheckoutStatus.PENDING,
        },
      });

      return newOrder;
    });

    // ── Phase 5: Coupon usage (outside TX — non-critical) ──────
    if (session.couponId && session.couponCode) {
      this.couponSvc
        .incrementUsage(
          session.couponId,
          customerId ?? null,
          customerPhone,
          order.id,
          discount,
        )
        .catch((err) =>
          this.logger.error('Coupon usage increment failed', err),
        );
    }

    // ── Phase 6: Async post-order actions ──────────────────────
    setImmediate(() => {
      this.notificationSvc
        .sendOrderConfirmation(order.id, customerPhone, customerEmail)
        .catch((err) => this.logger.error('Order notification failed', err));

      this.invoiceSvc
        .generateAndStore(order.id)
        .catch((err) => this.logger.error('Invoice generation failed', err));
    });

    this.logger.log(
      `Order #${order.orderNumber} created (${order.status}) — ${session.paymentMethod}`,
    );
    return order;
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN: LIST ORDERS
  // ══════════════════════════════════════════════════════════════
  async adminListOrders(dto: AdminListOrdersDto) {
    const skip = (dto.page - 1) * dto.limit;

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(dto.status && { status: dto.status }),
      ...(dto.customerId && { customerId: dto.customerId }),
      ...(dto.search && {
        OR: [
          { customerPhone: { contains: dto.search } },
          { customerEmail: { contains: dto.search, mode: 'insensitive' } },
          { customerFirstName: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...((dto.fromDate || dto.toDate) && {
        createdAt: {
          ...(dto.fromDate && { gte: new Date(dto.fromDate) }),
          ...(dto.toDate && {
            lte: (() => {
              const d = new Date(dto.toDate);
              d.setHours(23, 59, 59);
              return d;
            })(),
          }),
        },
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          subTotal: true,
          shippingCost: true,
          discount: true,
          total: true,
          currency: true,
          customerFirstName: true,
          customerLastName: true,
          customerPhone: true,
          customerEmail: true,
          couponCode: true,
          trackingNumber: true,
          createdAt: true,
          confirmedAt: true,
          shippedAt: true,
          deliveredAt: true,
          _count: { select: { products: true, returns: true } },
        },
        orderBy: { createdAt: dto.sortOrder ?? 'desc' },
        skip,
        take: dto.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
        hasNextPage: skip + dto.limit < total,
        hasPrevPage: dto.page > 1,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN: GET ORDER DETAIL
  // ══════════════════════════════════════════════════════════════
  async adminGetOrder(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        products: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        packages: {
          where: { deletedAt: null },
          include: {
            courier: {
              select: { id: true, name: true, trackingUrlTemplate: true },
            },
            rider: { select: { id: true, name: true, phone: true } },
          },
        },
        returns: { where: { deletedAt: null } },
        transaction: true,
        taxes: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN: UPDATE ORDER STATUS
  // ══════════════════════════════════════════════════════════════
  async adminUpdateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        customerPhone: true,
        customerEmail: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const validNext = VALID_TRANSITIONS[order.status] ?? [];
    if (!validNext.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}. Valid: [${validNext.join(', ')}]`,
      );
    }

    const timestamps: Record<string, Date | null> = {};
    if (dto.status === 'CONFIRMED') timestamps.confirmedAt = new Date();
    if (dto.status === 'SHIPPED') timestamps.shippedAt = new Date();
    if (dto.status === 'DELIVERED') timestamps.deliveredAt = new Date();
    if (dto.status === 'CANCELED') timestamps.canceledAt = new Date();
    if (dto.status === 'REFUNDED') timestamps.refundedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }),
          ...timestamps,
          updatedBy: adminId,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: dto.status,
          note: dto.note ?? null,
          changedBy: adminId,
        },
      });
    });

    // Notify customer on key status changes
    if (
      ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELED'].includes(dto.status)
    ) {
      setImmediate(() => {
        this.notificationSvc
          .sendOrderStatusUpdate(
            orderId,
            dto.status,
            order.customerPhone,
            order.customerEmail,
          )
          .catch((err) => this.logger.error('Status notification failed', err));
      });
    }

    return this.adminGetOrder(orderId);
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN: CANCEL ORDER
  // ══════════════════════════════════════════════════════════════
  async adminCancelOrder(orderId: string, adminId: string, reason?: string) {
    return this.adminUpdateStatus(
      orderId,
      {
        status: OrderStatus.CANCELED,
        note: reason ?? 'Cancelled by admin',
      },
      adminId,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN: CREATE PACKAGE
  // ══════════════════════════════════════════════════════════════
  async createPackage(orderId: string, dto: CreatePackageDto, adminId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException(
        'Order must be CONFIRMED or PROCESSING to create a package',
      );
    }

    const pkg = await this.prisma.orderPackage.create({
      data: {
        orderId,
        courierId: dto.courierId,
        riderId: dto.riderId ?? null,
        status: PackageStatus.CREATED,
        trackingNumber: dto.trackingNumber ?? null,
        items: dto.items as unknown as Prisma.InputJsonValue,
        packedBy: adminId,
        packedAt: new Date(),
      },
      include: {
        courier: { select: { id: true, name: true } },
        rider: { select: { id: true, name: true, phone: true } },
      },
    });

    // Auto-advance order to PROCESSING
    if (order.status === 'CONFIRMED') {
      await this.adminUpdateStatus(
        orderId,
        { status: OrderStatus.PROCESSING, note: 'Package created' },
        adminId,
      );
    }

    return pkg;
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN: UPDATE PACKAGE STATUS
  // ══════════════════════════════════════════════════════════════
  async updatePackageStatus(
    packageId: string,
    dto: UpdatePackageStatusDto,
    adminId: string,
  ) {
    const pkg = await this.prisma.orderPackage.findFirst({
      where: { id: packageId, deletedAt: null },
      select: { id: true, orderId: true, status: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    const timestamps: Record<string, Date | null> = {};
    if (dto.status === 'PICKED_UP') timestamps.pickedUpAt = new Date();
    if (dto.status === 'DELIVERED') timestamps.deliveredAt = new Date();
    if (dto.status === 'FAILED') timestamps.failedAt = new Date();
    if (dto.status === 'RETURNED') timestamps.returnedAt = new Date();
    if (dto.status === 'ASSIGNED') timestamps.assignedAt = new Date();
    if (dto.status === 'ASSIGNED')
      timestamps.assignedBy = adminId as unknown as Date;

    await this.prisma.orderPackage.update({
      where: { id: packageId },
      data: {
        status: dto.status,
        ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }),
        ...(dto.deliveryDetails && {
          deliveryDetails: dto.deliveryDetails as Prisma.InputJsonValue,
        }),
        ...timestamps,
      },
    });

    // Sync order status based on package status
    if (dto.status === 'PICKED_UP' || dto.status === 'IN_TRANSIT') {
      await this.adminUpdateStatus(
        pkg.orderId,
        { status: OrderStatus.SHIPPED },
        adminId,
      );
    } else if (dto.status === 'DELIVERED') {
      await this.adminUpdateStatus(
        pkg.orderId,
        { status: OrderStatus.DELIVERED },
        adminId,
      );
    }

    return this.prisma.orderPackage.findUnique({ where: { id: packageId } });
  }
}
