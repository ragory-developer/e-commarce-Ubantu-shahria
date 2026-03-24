// ─── src/customer/customer.service.ts ────────────────────────
// Production-ready customer service

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import {
  UpdateCustomerProfileDto,
  ChangePasswordDto,
  UpgradeGuestDto,
  CustomerOrdersQueryDto,
  CustomerWalletQueryDto,
  CustomerCreateReturnDto,
} from './dto';
import { AUTH_CONFIG, AUTH_ERROR } from '../auth/auth.constants';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TokenService))
    private readonly tokenService: TokenService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════════════════════════

  /**
   * Get customer profile
   */
  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        isActive: true,
        avatar: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        wallet: {
          select: { balance: true, currency: true, isActive: true },
        },
        _count: {
          select: { orders: true, addresses: true, reviews: true },
        },
      },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    return {
      ...customer,
      stats: {
        orderCount: customer._count.orders,
        addressCount: customer._count.addresses,
        reviewCount: customer._count.reviews,
      },
      _count: undefined,
    };
  }

  /**
   * Update customer own profile
   * Phone is the primary identifier and CANNOT be changed here.
   */
  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    await this.ensureCustomerExists(customerId);

    if (dto.email) {
      const emailTaken = await this.prisma.customer.findFirst({
        where: { email: dto.email, id: { not: customerId }, deletedAt: null },
        select: { id: true },
      });
      if (emailTaken)
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && {
          email: dto.email,
          emailVerified: false, // Requires re-verification
        }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        avatar: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Change own password (must supply current password)
   */
  async changePassword(
    customerId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, password: true, isGuest: true },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    if (customer.isGuest || !customer.password) {
      throw new BadRequestException(
        'No password set on this account. Use POST /customer/upgrade-to-account instead.',
      );
    }

    const valid = await bcrypt.compare(dto.currentPassword, customer.password);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must differ from current password',
      );
    }

    const hashed = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { password: hashed },
    });

    // Revoke all sessions to force re-login
    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    this.logger.log(`Customer ${customerId} changed their password`);
  }

  /**
   * Upgrade guest account to full registered account.
   * Requirements:
   *   1. Customer must be a guest (isGuest: true)
   *   2. Phone must be verified (phoneVerified: true)
   *   3. Set password → isGuest becomes false
   */
  async upgradeGuest(customerId: string, dto: UpgradeGuestDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        isGuest: true,
        phoneVerified: true,
        phone: true,
        email: true,
      },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    if (!customer.isGuest) {
      throw new BadRequestException(
        'Account is already a full registered account',
      );
    }

    if (!customer.phoneVerified) {
      throw new ForbiddenException(
        'Phone must be verified before upgrading. ' +
          'Use POST /auth/customer/verify-phone/request first.',
      );
    }

    if (dto.email) {
      const emailTaken = await this.prisma.customer.findFirst({
        where: { email: dto.email, id: { not: customerId }, deletedAt: null },
        select: { id: true },
      });
      if (emailTaken)
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isGuest: false,
        password: hashedPassword,
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email && { email: dto.email, emailVerified: false }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        createdAt: true,
      },
    });

    this.logger.log(`Guest ${customerId} upgraded to full account`);
    return updated;
  }

  /**
   * Deactivate own account (soft — all sessions revoked)
   */
  async deactivateAccount(customerId: string): Promise<void> {
    await this.ensureCustomerExists(customerId);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    this.logger.log(`Customer ${customerId} deactivated their account`);
  }

  // ══════════════════════════════════════════════════════════════
  // ORDERS
  // ══════════════════════════════════════════════════════════════

  /**
   * Get own order history with pagination + status filter
   */
  async getMyOrders(customerId: string, dto: CustomerOrdersQueryDto) {
    await this.ensureCustomerExists(customerId);

    const skip = (dto.page - 1) * dto.limit;

    const where: any = {
      customerId,
      deletedAt: null,
      ...(dto.status && { status: dto.status }),
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
          couponCode: true,
          trackingNumber: true,
          courierName: true,
          createdAt: true,
          confirmedAt: true,
          shippedAt: true,
          deliveredAt: true,
          canceledAt: true,
          products: {
            select: {
              id: true,
              productName: true,
              productSku: true,
              productImage: true,
              unitPrice: true,
              qty: true,
              lineTotal: true,
              variationsSnapshot: true,
            },
          },
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

  /**
   * Get single order detail (must belong to customer)
   */
  async getMyOrderById(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        shippingAddress: true,
        billingAddress: true,
        subTotal: true,
        shippingCost: true,
        discount: true,
        taxTotal: true,
        total: true,
        currency: true,
        couponCode: true,
        couponDiscountType: true,
        couponDiscountValue: true,
        walletAmountUsed: true,
        trackingNumber: true,
        courierName: true,
        notes: true,
        createdAt: true,
        confirmedAt: true,
        shippedAt: true,
        deliveredAt: true,
        canceledAt: true,
        refundedAt: true,
        products: {
          select: {
            id: true,
            productName: true,
            productSku: true,
            productSlug: true,
            productImage: true,
            unitPrice: true,
            qty: true,
            lineTotal: true,
            variationsSnapshot: true,
          },
        },
        statusHistory: {
          select: {
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        packages: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            trackingNumber: true,
            courier: { select: { name: true, trackingUrlTemplate: true } },
            pickedUpAt: true,
            deliveredAt: true,
          },
        },
        returns: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            reason: true,
            reasonDetail: true,
            createdAt: true,
          },
        },
        transaction: {
          select: {
            id: true,
            transactionId: true,
            paymentMethod: true,
            paymentStatus: true,
            amount: true,
            paidAt: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ══════════════════════════════════════════════════════════════
  // WALLET
  // ══════════════════════════════════════════════════════════════

  /**
   * Get own wallet balance + transaction history
   */
  async getMyWallet(customerId: string, dto: CustomerWalletQueryDto) {
    await this.ensureCustomerExists(customerId);

    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId },
      select: {
        id: true,
        balance: true,
        currency: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!wallet) {
      return {
        wallet: null,
        transactions: [],
        meta: { total: 0, page: dto.page, limit: dto.limit, totalPages: 0 },
      };
    }

    const skip = (dto.page - 1) * dto.limit;

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        select: {
          id: true,
          type: true,
          amount: true,
          balance: true,
          orderId: true,
          description: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: dto.limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      wallet,
      transactions,
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
  // REVIEWS
  // ══════════════════════════════════════════════════════════════

  /**
   * Get customer's own submitted reviews
   */
  async getMyReviews(customerId: string, page = 1, limit = 20) {
    await this.ensureCustomerExists(customerId);

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { reviewerId: customerId, deletedAt: null },
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          isApproved: true,
          adminReply: true,
          createdAt: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: { reviewerId: customerId, deletedAt: null },
      }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // ── Request a return ─────────────────────────────────────────────
  async createReturn(customerId: string, dto: CustomerCreateReturnDto) {
    // 1. Validate order belongs to customer and is delivered
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, customerId, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveredAt: true,
        products: {
          select: {
            id: true,
            productName: true,
            qty: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Only DELIVERED orders can be returned');
    }

    // 2. Return window check (default 7 days, reads from settings if available)
    if (order.deliveredAt) {
      const windowDays = 7;
      const cutoff = new Date(
        order.deliveredAt.getTime() + windowDays * 86_400_000,
      );
      if (new Date() > cutoff) {
        throw new BadRequestException(
          `Return window of ${windowDays} days has passed`,
        );
      }
    }

    // 3. Check for duplicate pending return on same order
    const existing = await this.prisma.orderReturn.findFirst({
      where: {
        orderId: dto.orderId,
        customerId,
        status: { in: ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED'] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing)
      throw new BadRequestException(
        'A pending return request already exists for this order',
      );

    // 4. Validate each item exists in order and qty ≤ ordered qty
    const orderProductMap = new Map(order.products.map((p) => [p.id, p]));
    const items = dto.items.map((item) => {
      const op = orderProductMap.get(item.orderProductId);
      if (!op)
        throw new BadRequestException(
          `Order product ${item.orderProductId} not found`,
        );
      if (item.qty > op.qty)
        throw new BadRequestException(
          `Cannot return more than ordered qty for "${op.productName}"`,
        );
      return {
        orderProductId: item.orderProductId,
        productName: op.productName,
        qty: item.qty,
        unitPrice: op.unitPrice,
      };
    });

    const ret = await this.prisma.orderReturn.create({
      data: {
        orderId: dto.orderId,
        customerId,
        items: items as any,
        reason: dto.reason,
        reasonDetail: dto.reasonDetail ?? null,
        evidenceImages: dto.evidenceImages ? (dto.evidenceImages as any) : null,
        status: 'REQUESTED',
      },
      select: {
        id: true,
        orderId: true,
        reason: true,
        reasonDetail: true,
        status: true,
        createdAt: true,
      },
    });

    this.logger.log(
      `Customer ${customerId} requested return for order ${dto.orderId}`,
    );
    return ret;
  }

  // ══════════════════════════════════════════════════════════════
  // RETURN REQUESTS
  // ══════════════════════════════════════════════════════════════

  /**
   * Get own return requests
   */
  async getMyReturns(customerId: string, page = 1, limit = 20) {
    await this.ensureCustomerExists(customerId);

    const skip = (page - 1) * limit;

    const [returns, total] = await Promise.all([
      this.prisma.orderReturn.findMany({
        where: { customerId, deletedAt: null },
        select: {
          id: true,
          reason: true,
          reasonDetail: true,
          status: true,
          refundMethod: true,
          walletCreditAmount: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              orderNumber: true,
              total: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.orderReturn.count({ where: { customerId, deletedAt: null } }),
    ]);

    return {
      data: returns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // DEVICES / ACTIVE SESSIONS
  // ══════════════════════════════════════════════════════════════

  /**
   * List own active devices/sessions
   */
  async getMyDevices(customerId: string) {
    return this.prisma.device.findMany({
      where: { customerId, isActive: true, revokedAt: null },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        deviceType: true,
        ipAddress: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Revoke a specific device session
   */
  async revokeDevice(customerId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, customerId, isActive: true },
      select: { id: true },
    });

    if (!device) throw new NotFoundException('Device session not found');

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: false, revokedAt: new Date() },
    });

    // Revoke associated tokens
    await this.prisma.authToken.updateMany({
      where: { deviceId, customerId, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: 'Device revoked by user',
      },
    });

    this.logger.log(`Customer ${customerId} revoked device ${deviceId}`);
  }

  /**
   * Revoke ALL other devices (keep current session intact)
   */
  async revokeAllOtherDevices(
    customerId: string,
    currentDeviceId?: string,
  ): Promise<void> {
    const whereDevice: any = { customerId, isActive: true };
    if (currentDeviceId) whereDevice.id = { not: currentDeviceId };

    await this.prisma.device.updateMany({
      where: whereDevice,
      data: { isActive: false, revokedAt: new Date() },
    });

    const whereToken: any = { customerId, revoked: false };
    if (currentDeviceId) whereToken.deviceId = { not: currentDeviceId };

    await this.prisma.authToken.updateMany({
      where: whereToken,
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: 'Revoked by user',
      },
    });

    this.logger.log(`Customer ${customerId} revoked all other devices`);
  }

  // ══════════════════════════════════════════════════════════════
  // ACCOUNT SUMMARY
  // ══════════════════════════════════════════════════════════════

  /**
   * Full account summary (dashboard view for customer)
   */
  async getAccountSummary(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        isActive: true,
        avatar: true,
        lastLoginAt: true,
        createdAt: true,
        wallet: {
          select: { balance: true, currency: true },
        },
        _count: {
          select: {
            orders: true,
            addresses: true,
            reviews: true,
          },
        },
      },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    // Pending orders
    const pendingOrders = await this.prisma.order.count({
      where: {
        customerId,
        deletedAt: null,
        status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
      },
    });

    return {
      profile: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        phoneVerified: customer.phoneVerified,
        email: customer.email,
        emailVerified: customer.emailVerified,
        isGuest: customer.isGuest,
        isActive: customer.isActive,
        avatar: customer.avatar,
        lastLoginAt: customer.lastLoginAt,
        createdAt: customer.createdAt,
      },
      wallet: customer.wallet ?? { balance: 0, currency: 'BDT' },
      stats: {
        totalOrders: customer._count.orders,
        activeOrders: pendingOrders,
        addresses: customer._count.addresses,
        reviews: customer._count.reviews,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════

  private async ensureCustomerExists(customerId: string): Promise<void> {
    const exists = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);
  }
}
