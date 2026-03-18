import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PromotionType } from '@prisma/client';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ListPromotionsDto,
} from './dto';

export interface CartItem {
  productId: string;
  categoryIds: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PromotionEligibilityResult {
  eligible: boolean;
  promotionId: string;
  name: string;
  type: PromotionType;
  discountAmount: number;
  freeShipping: boolean;
  message: string;
}

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionDto, createdBy: string) {
    const existing = await this.prisma.promotion.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('Promotion with this slug already exists');

    const promo = await this.prisma.promotion.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        type: dto.type,
        isAutoApply: dto.isAutoApply ?? false,
        isStackable: dto.isStackable ?? false,
        priority: dto.priority ?? 0,
        rules: dto.rules as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        usageLimit: dto.usageLimit ?? null,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    this.logger.log(`Promotion created: ${promo.slug} by ${createdBy}`);
    return promo;
  }

  async findAll(dto: ListPromotionsDto) {
    const now = new Date();
    const where: Prisma.PromotionWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        name: { contains: dto.search, mode: 'insensitive' },
      }),
      ...(dto.type && { type: dto.type }),
      ...(dto.isAutoApply !== undefined && { isAutoApply: dto.isAutoApply }),
      ...(dto.activeOnly && {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return {
      data,
      total,
      meta: {
        skip: dto.skip,
        take: dto.take,
        page: Math.floor(dto.skip / dto.take) + 1,
        pageCount: Math.ceil(total / dto.take),
      },
    };
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findFirst({
      where: { id, deletedAt: null },
    });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  async update(id: string, dto: UpdatePromotionDto, updatedBy: string) {
    await this.findOne(id);

    if (dto.slug) {
      const dup = await this.prisma.promotion.findFirst({
        where: { slug: dto.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Promotion slug already in use');
    }

    const promo = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.isAutoApply !== undefined && { isAutoApply: dto.isAutoApply }),
        ...(dto.isStackable !== undefined && { isStackable: dto.isStackable }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.rules && { rules: dto.rules as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(`Promotion updated: ${id} by ${updatedBy}`);
    return promo;
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.softDelete('promotion', id, deletedBy);
    this.logger.log(`Promotion deleted: ${id} by ${deletedBy}`);
  }

  /**
   * Evaluate all auto-apply promotions against a cart.
   * Called by CheckoutService before order placement.
   * Returns eligible promotions sorted by priority (highest first).
   */
  async evaluateAutoApply(
    cartItems: CartItem[],
    cartTotal: number,
    customerId: string | null,
    isFirstOrder: boolean,
  ): Promise<PromotionEligibilityResult[]> {
    const now = new Date();
    const promos = await this.prisma.promotion.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        isAutoApply: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    const results: PromotionEligibilityResult[] = [];

    for (const promo of promos) {
      // Usage limit check
      if (promo.usageLimit && promo.used >= promo.usageLimit) continue;

      const rules = promo.rules as any;
      const result = this.evaluateRules(
        promo,
        rules,
        cartItems,
        cartTotal,
        isFirstOrder,
      );

      if (result.eligible) {
        results.push(result);
        // Stop processing non-stackable promotions
        if (!promo.isStackable) break;
      }
    }

    return results;
  }

  private evaluateRules(
    promo: any,
    rules: any,
    cartItems: CartItem[],
    cartTotal: number,
    isFirstOrder: boolean,
  ): PromotionEligibilityResult {
    const base = {
      eligible: false,
      promotionId: promo.id,
      name: promo.name,
      type: promo.type,
      discountAmount: 0,
      freeShipping: false,
      message: '',
    };

    switch (promo.type as PromotionType) {
      case 'CART_DISCOUNT': {
        if (rules.minCartValue && cartTotal < rules.minCartValue) {
          return {
            ...base,
            message: `Minimum cart value is ${rules.minCartValue}`,
          };
        }
        const discount =
          rules.discountType === 'PERCENT'
            ? (cartTotal * rules.discountValue) / 100
            : rules.discountValue;
        return {
          ...base,
          eligible: true,
          discountAmount: parseFloat(discount.toFixed(2)),
          message: promo.name,
        };
      }

      case 'PRODUCT_DISCOUNT': {
        const matchingItems = cartItems.filter(
          (item) =>
            rules.productIds?.includes(item.productId) ||
            rules.categoryIds?.some((cid: string) =>
              item.categoryIds.includes(cid),
            ),
        );
        if (!matchingItems.length)
          return { ...base, message: 'No matching products in cart' };
        const eligibleTotal = matchingItems.reduce(
          (s, i) => s + i.lineTotal,
          0,
        );
        const discount =
          rules.discountType === 'PERCENT'
            ? (eligibleTotal * rules.discountValue) / 100
            : rules.discountValue * matchingItems.length;
        return {
          ...base,
          eligible: true,
          discountAmount: parseFloat(discount.toFixed(2)),
          message: promo.name,
        };
      }

      case 'FREE_SHIPPING':
        if (rules.minCartValue && cartTotal < rules.minCartValue) {
          return {
            ...base,
            message: `Minimum cart value for free shipping is ${rules.minCartValue}`,
          };
        }
        return {
          ...base,
          eligible: true,
          discountAmount: 0,
          freeShipping: true,
          message: promo.name,
        };

      case 'FIRST_ORDER':
        if (!isFirstOrder)
          return { ...base, message: 'Offer only for first order' };
        const discount =
          rules.discountType === 'PERCENT'
            ? (cartTotal * rules.discountValue) / 100
            : rules.discountValue;
        return {
          ...base,
          eligible: true,
          discountAmount: parseFloat(discount.toFixed(2)),
          message: promo.name,
        };

      case 'BUY_X_GET_Y': {
        const eligible = cartItems.some(
          (item) =>
            (rules.buyProductIds?.includes(item.productId) ||
              rules.buyCategoryIds?.some((cid: string) =>
                item.categoryIds.includes(cid),
              )) &&
            item.qty >= (rules.buyQty ?? 1),
        );
        if (!eligible) return { ...base, message: 'Buy X condition not met' };
        return {
          ...base,
          eligible: true,
          discountAmount: 0,
          message: promo.name,
        };
      }

      case 'BUNDLE_DISCOUNT': {
        const requiredIds: string[] = rules.productIds ?? [];
        const cartIds = cartItems.map((i) => i.productId);
        const allPresent = requiredIds.every((id) => cartIds.includes(id));
        if (!allPresent)
          return { ...base, message: 'Bundle products not all in cart' };
        const discount =
          rules.discountType === 'PERCENT'
            ? (cartTotal * rules.discountValue) / 100
            : rules.discountValue;
        return {
          ...base,
          eligible: true,
          discountAmount: parseFloat(discount.toFixed(2)),
          message: promo.name,
        };
      }

      default:
        return base;
    }
  }
}
