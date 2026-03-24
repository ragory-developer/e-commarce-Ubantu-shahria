import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CheckoutStatus, ReservationStatus } from '@prisma/client';
import { StockReservationService } from '../stock-reservation/stock-reservation.service';
import { ProductService } from '../product/product.service';
import { CouponService } from '../coupon/coupon.service';
import { WalletService } from '../wallet/wallet.service';
import { ShippingService } from '../shipping/shipping.service';
import { AddressService } from '../address/address.service';
import {
  InitiateCheckoutDto,
  SetAddressDto,
  ApplyCouponDto,
  SelectPaymentDto,
  PlaceOrderDto,
  UpdateItemsDto,
  SetWalletAmountDto,
} from './dto';

// ─── Internal Types ────────────────────────────────────────────
export interface CartItemSnapshot {
  productId: string;
  variantId: string | null;
  productName: string;
  productSku: string | null;
  productSlug: string;
  productImage: any;
  variationsSnapshot: any;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  reservationId: string | null;
  taxClassId: string | null;
}

export interface CartSnapshot {
  items: CartItemSnapshot[];
  guestInfo?: { fullName: string; phone: string; email?: string };
}

export interface CheckoutTotals {
  subTotal: number;
  shippingCost: number;
  discount: number;
  taxTotal: number;
  walletAmountUsed: number;
  total: number;
}

const SESSION_TTL_MINUTES = 30;

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockSvc: StockReservationService,
    private readonly productSvc: ProductService,
    private readonly couponSvc: CouponService,
    private readonly walletSvc: WalletService,
    private readonly shippingSvc: ShippingService,
    private readonly addressSvc: AddressService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // INITIATE CHECKOUT
  // ══════════════════════════════════════════════════════════════
  async initiate(dto: InitiateCheckoutDto, customerId?: string) {
    if (!dto.items?.length) throw new BadRequestException('Cart is empty');

    // 1. Validate all items and get fresh prices
    const validated = await this.productSvc.validateForCheckout(
      dto.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
    );

    if (!validated.valid) {
      throw new BadRequestException({
        message: 'Some cart items are invalid or unavailable',
        errors: validated.errors,
      });
    }

    // 2. Reserve stock for each item
    const cartItems: CartItemSnapshot[] = [];
    for (const line of validated.lines) {
      const item = dto.items.find(
        (i) =>
          i.productId === line.productId &&
          (i.variantId ?? null) === line.variantId,
      )!;

      let reservationId: string | null = null;

      // Reserve stock (only for stock-managed products)
      const reservation = await this.stockSvc.reserve({
        productId: line.productId,
        productVariantId: line.variantId,
        qty: item.qty,
        customerId,
        sessionId: dto.sessionId,
        expiresInMinutes: SESSION_TTL_MINUTES,
      });

      if (reservation.success) {
        reservationId = reservation.reservationId ?? null;
      }

      cartItems.push({
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        productSku: line.productSku,
        productSlug: line.productSlug,
        productImage: line.productImage,
        variationsSnapshot: line.variationsSnapshot,
        unitPrice: line.unitPrice,
        qty: item.qty,
        lineTotal: parseFloat((line.unitPrice * item.qty).toFixed(4)),
        reservationId,
        taxClassId: (line as any).taxClassId ?? null,
      });
    }

    const subTotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);

    const cartSnapshot: CartSnapshot = {
      items: cartItems,
      ...(dto.guestInfo && { guestInfo: dto.guestInfo }),
    };

    // 3. Create or update checkout session
    const session = await this.prisma.checkoutSession.create({
      data: {
        customerId: customerId ?? null,
        sessionId: dto.sessionId ?? null,
        cartSnapshot: cartSnapshot as unknown as Prisma.InputJsonValue,
        addressSnapshot: {} as Prisma.InputJsonValue,
        subTotal: new Prisma.Decimal(subTotal),
        discount: new Prisma.Decimal(0),
        shippingCost: new Prisma.Decimal(0),
        total: new Prisma.Decimal(subTotal),
        paymentMethod: 'COD', // default, updated later
        status: CheckoutStatus.PENDING,
        expiresAt,
        walletAmountUsed: new Prisma.Decimal(0),
      },
    });

    return {
      sessionId: session.id,
      summary: this.buildSummary(session, cartItems),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE ITEMS
  // ══════════════════════════════════════════════════════════════
  async updateItems(
    sessionId: string,
    dto: UpdateItemsDto,
    customerId?: string,
  ) {
    const session = await this.getValidSession(sessionId, customerId);
    const oldSnapshot = session.cartSnapshot as unknown as CartSnapshot;

    // Release existing reservations
    for (const item of oldSnapshot.items) {
      if (item.reservationId) {
        await this.stockSvc.release(item.reservationId);
      }
    }

    // Re-validate and re-reserve
    const validated = await this.productSvc.validateForCheckout(
      dto.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
    );

    if (!validated.valid) {
      throw new BadRequestException({
        message: 'Cart item errors',
        errors: validated.errors,
      });
    }

    const cartItems: CartItemSnapshot[] = [];
    for (const line of validated.lines) {
      const item = dto.items.find(
        (i) =>
          i.productId === line.productId &&
          (i.variantId ?? null) === line.variantId,
      )!;
      const reservation = await this.stockSvc.reserve({
        productId: line.productId,
        productVariantId: line.variantId,
        qty: item.qty,
        customerId,
        sessionId,
        expiresInMinutes: SESSION_TTL_MINUTES,
      });

      cartItems.push({
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        productSku: line.productSku,
        productSlug: line.productSlug,
        productImage: line.productImage,
        variationsSnapshot: line.variationsSnapshot,
        unitPrice: line.unitPrice,
        qty: item.qty,
        lineTotal: parseFloat((line.unitPrice * item.qty).toFixed(4)),
        reservationId: reservation.reservationId ?? null,
        taxClassId: (line as any).taxClassId ?? null,
      });
    }

    const subTotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
    const cartSnapshot: CartSnapshot = {
      items: cartItems,
      guestInfo: oldSnapshot.guestInfo,
    };

    const updated = await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        cartSnapshot: cartSnapshot as unknown as Prisma.InputJsonValue,
        subTotal: new Prisma.Decimal(subTotal),
        total: new Prisma.Decimal(subTotal),
        discount: new Prisma.Decimal(0),
        couponId: null,
        couponCode: null,
        couponDiscountType: null,
        couponDiscountValue: null,
        expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60_000),
      },
    });

    return { summary: this.buildSummary(updated, cartItems) };
  }

  // ══════════════════════════════════════════════════════════════
  // SET ADDRESS
  // ══════════════════════════════════════════════════════════════
  async setAddress(sessionId: string, dto: SetAddressDto, customerId?: string) {
    const session = await this.getValidSession(sessionId, customerId);

    let addressSnapshot: Record<string, any>;
    let deliveryZoneId: string | null = null;

    if (dto.addressId && customerId) {
      // Use saved address
      const addr = await this.addressSvc.findOne(dto.addressId, customerId);
      addressSnapshot = {
        id: addr.id,
        fullName: addr.fullName,
        phone: addr.phone,
        addressLine: addr.addressLine,
        division: (addr as any).division?.name ?? null,
        city: (addr as any).city?.name ?? null,
        area: (addr as any).area?.name ?? null,
        postalCode: addr.postalCode,
        country: addr.country,
      };

      const zoneResult = await this.addressSvc.getDeliveryZoneForAddress(
        dto.addressId,
        customerId,
      );
      if (!zoneResult.deliverable) {
        throw new BadRequestException(
          zoneResult.reason ?? 'Address not deliverable',
        );
      }
      deliveryZoneId = zoneResult.deliveryZone!.id;
    } else if (dto.address) {
      // Inline address (guest or override)
      const snapshot = dto.address;
      addressSnapshot = {
        fullName: snapshot.fullName,
        phone: snapshot.phone,
        addressLine: snapshot.addressLine,
        postalCode: snapshot.postalCode,
        country: snapshot.country ?? 'BD',
        areaId: snapshot.areaId,
        cityId: snapshot.cityId,
        divisionId: snapshot.divisionId,
      };

      // Resolve delivery zone from area
      const area = await this.prisma.area.findFirst({
        where: { id: snapshot.areaId, isActive: true },
        include: {
          deliveryZone: { select: { id: true, name: true, isActive: true } },
          city: {
            select: { name: true, division: { select: { name: true } } },
          },
        },
      });

      if (!area) throw new BadRequestException('Invalid area selected');
      if (!area.deliveryZone?.isActive)
        throw new BadRequestException('No active delivery zone for this area');

      deliveryZoneId = area.deliveryZone.id;
      addressSnapshot.division = area.city.division.name;
      addressSnapshot.city = area.city.name;
      addressSnapshot.area = area.name;
    } else {
      throw new BadRequestException('Provide either addressId or address');
    }

    // Get shipping options
    const snapshot = session.cartSnapshot as unknown as CartSnapshot;
    const cartTotal = snapshot.items.reduce((s, i) => s + i.lineTotal, 0);
    const totalWeight = snapshot.items.reduce((s, i) => s + i.qty * 0.5, 0); // approximate

    const shippingOptions = await this.shippingSvc.calculateShippingOptions({
      deliveryZoneId,
      cartTotal,
      totalWeight,
      itemCount: snapshot.items.reduce((s, i) => s + i.qty, 0),
      ...(dto.courierId ? { courierId: dto.courierId } : {}),
    });

    if (!shippingOptions.length) {
      throw new BadRequestException(
        'No shipping options available for this address',
      );
    }

    // Select cheapest by default (or specified courier)
    const selected = dto.courierId
      ? (shippingOptions.find((o) => o.courierId === dto.courierId) ??
        shippingOptions[0])
      : shippingOptions[0];

    const subTotal = parseFloat(session.subTotal.toString());
    const discount = parseFloat(session.discount.toString());
    const walletUsed = parseFloat(session.walletAmountUsed.toString());
    const shippingCost = selected.totalCost;
    const total = Math.max(0, subTotal - discount + shippingCost - walletUsed);

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        addressSnapshot: addressSnapshot as Prisma.InputJsonValue,
        ...(dto.addressId ? { addressId: dto.addressId } : {}),
        deliveryZoneId,
        courierId: selected.courierId,
        shippingCost: new Prisma.Decimal(shippingCost),
        total: new Prisma.Decimal(total),
      },
    });

    return {
      shippingOptions,
      selected,
      addressSnapshot,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // APPLY COUPON
  // ══════════════════════════════════════════════════════════════
  async applyCoupon(
    sessionId: string,
    dto: ApplyCouponDto,
    customerId?: string,
  ) {
    const session = await this.getValidSession(sessionId, customerId);
    const snapshot = session.cartSnapshot as unknown as CartSnapshot;
    const subTotal = parseFloat(session.subTotal.toString());

    const productIds = snapshot.items.map((i) => i.productId);

    const result = await this.couponSvc.validateCoupon({
      code: dto.code,
      orderTotal: subTotal,
      customerId,
      productIds,
    });

    if (!result.valid) {
      throw new BadRequestException(result.message ?? 'Invalid coupon code');
    }

    const coupon = await this.couponSvc.findByCode(dto.code);
    const discount = result.discountAmount!;
    const shippingCost = result.freeShipping
      ? 0
      : parseFloat(session.shippingCost.toString());
    const walletUsed = parseFloat(session.walletAmountUsed.toString());
    const total = Math.max(0, subTotal - discount + shippingCost - walletUsed);

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        couponId: coupon.id,
        couponCode: dto.code,
        couponDiscountType: result.discountType,
        couponDiscountValue: result.discountValue
          ? new Prisma.Decimal(result.discountValue)
          : null,
        discount: new Prisma.Decimal(discount),
        shippingCost: new Prisma.Decimal(shippingCost),
        total: new Prisma.Decimal(total),
      },
    });

    return {
      couponCode: dto.code,
      discountAmount: discount,
      freeShipping: result.freeShipping,
      total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // REMOVE COUPON
  // ══════════════════════════════════════════════════════════════
  async removeCoupon(sessionId: string, customerId?: string) {
    const session = await this.getValidSession(sessionId, customerId);
    const subTotal = parseFloat(session.subTotal.toString());
    const shippingCost = parseFloat(session.shippingCost.toString());
    const walletUsed = parseFloat(session.walletAmountUsed.toString());
    const total = Math.max(0, subTotal + shippingCost - walletUsed);

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        couponId: null,
        couponCode: null,
        couponDiscountType: null,
        couponDiscountValue: null,
        discount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(total),
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SET WALLET AMOUNT
  // ══════════════════════════════════════════════════════════════
  async setWalletAmount(
    sessionId: string,
    dto: SetWalletAmountDto,
    customerId: string,
  ) {
    const session = await this.getValidSession(sessionId, customerId);
    const walletBalance = await this.walletSvc.getBalance(customerId);

    const subTotal = parseFloat(session.subTotal.toString());
    const discount = parseFloat(session.discount.toString());
    const shipping = parseFloat(session.shippingCost.toString());
    const maxPayable = Math.max(0, subTotal - discount + shipping);

    const walletToUse = Math.min(dto.amount, walletBalance, maxPayable);
    const total = Math.max(0, maxPayable - walletToUse);

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        walletAmountUsed: new Prisma.Decimal(walletToUse),
        total: new Prisma.Decimal(total),
      },
    });

    return { walletBalance, walletAmountUsed: walletToUse, total };
  }

  // ══════════════════════════════════════════════════════════════
  // SELECT PAYMENT METHOD
  // ══════════════════════════════════════════════════════════════
  async selectPayment(
    sessionId: string,
    dto: SelectPaymentDto,
    customerId?: string,
  ) {
    const session = await this.getValidSession(sessionId, customerId);

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: { paymentMethod: dto.method },
    });

    return { method: dto.method };
  }

  // ══════════════════════════════════════════════════════════════
  // GET SUMMARY
  // ══════════════════════════════════════════════════════════════
  async getSummary(sessionId: string, customerId?: string) {
    const session = await this.getValidSession(sessionId, customerId);
    const snapshot = session.cartSnapshot as unknown as CartSnapshot;

    let walletBalance: number | null = null;
    if (customerId) {
      walletBalance = await this.walletSvc.getBalance(customerId);
    }

    return {
      sessionId: session.id,
      status: session.status,
      expiresAt: session.expiresAt,
      items: snapshot.items,
      addressSnapshot: session.addressSnapshot,
      couponCode: session.couponCode,
      paymentMethod: session.paymentMethod,
      financials: {
        subTotal: parseFloat(session.subTotal.toString()),
        shippingCost: parseFloat(session.shippingCost.toString()),
        discount: parseFloat(session.discount.toString()),
        walletAmountUsed: parseFloat(session.walletAmountUsed.toString()),
        total: parseFloat(session.total.toString()),
      },
      walletBalance,
      deliveryZoneId: session.deliveryZoneId,
      courierId: session.courierId,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CANCEL CHECKOUT
  // ══════════════════════════════════════════════════════════════
  async cancelCheckout(sessionId: string, customerId?: string) {
    const session = await this.getValidSession(sessionId, customerId);
    const snapshot = session.cartSnapshot as unknown as CartSnapshot;

    // Release all stock reservations
    for (const item of snapshot.items) {
      if (item.reservationId) {
        await this.stockSvc.release(item.reservationId).catch(() => {});
      }
    }

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: { status: CheckoutStatus.CANCELED },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PLACE ORDER (COD — synchronous)
  // ══════════════════════════════════════════════════════════════
  async placeOrder(sessionId: string, dto: PlaceOrderDto, customerId?: string) {
    const session = await this.getValidSession(sessionId, customerId);

    if (session.orderId) {
      throw new ConflictException('Order already placed for this session');
    }

    if (!session.deliveryZoneId) {
      throw new BadRequestException('Please set a delivery address first');
    }

    if (session.paymentMethod !== 'COD') {
      throw new BadRequestException(
        'Use the payment gateway flow for online payments',
      );
    }

    // Delegate to OrderService (imported via module context)
    return session; // OrderService.createFromSession is called in CheckoutController
  }

  // ══════════════════════════════════════════════════════════════
  // INTERNAL
  // ══════════════════════════════════════════════════════════════

  async getValidSession(sessionId: string, customerId?: string) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: {
        id: sessionId,
        status: CheckoutStatus.PENDING,
        ...(customerId ? { customerId } : {}),
      },
    });

    if (!session) {
      throw new NotFoundException('Checkout session not found or expired');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.checkoutSession.update({
        where: { id: sessionId },
        data: { status: CheckoutStatus.EXPIRED },
      });
      throw new BadRequestException(
        'Checkout session has expired. Please start again.',
      );
    }

    return session;
  }

  private buildSummary(session: any, items: CartItemSnapshot[]) {
    return {
      sessionId: session.id,
      items,
      subTotal: parseFloat(session.subTotal.toString()),
      shippingCost: parseFloat(session.shippingCost.toString()),
      discount: parseFloat(session.discount.toString()),
      walletAmountUsed: parseFloat(session.walletAmountUsed.toString()),
      total: parseFloat(session.total.toString()),
      expiresAt: session.expiresAt,
    };
  }
}
