import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CouponDiscountType } from '@prisma/client';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ListCouponsDto,
  ValidateCouponDto,
} from './dto';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto, createdBy: string) {
    const existing = await this.prisma.coupon.findFirst({
      where: { code: dto.code.toUpperCase(), deletedAt: null },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Coupon code already exists');

    if (dto.products?.length) {
      const found = await this.prisma.product.findMany({
        where: { id: { in: dto.products }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== dto.products.length)
        throw new NotFoundException('One or more products not found');
    }

    if (dto.categories?.length) {
      const found = await this.prisma.category.findMany({
        where: { id: { in: dto.categories }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== dto.categories.length)
        throw new NotFoundException('One or more categories not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({
        data: {
          name: dto.name,
          code: dto.code.toUpperCase(),
          description: dto.description ?? null,
          discountType: dto.discountType,
          discountValue: new Prisma.Decimal(dto.discountValue), // ← correct field
          freeShipping: dto.freeShipping ?? false,
          minOrderValue:
            dto.minOrderValue != null
              ? new Prisma.Decimal(dto.minOrderValue)
              : null, // ← correct field
          maxOrderValue:
            dto.maxOrderValue != null
              ? new Prisma.Decimal(dto.maxOrderValue)
              : null, // ← correct field
          usageLimit: dto.usageLimit ?? null, // ← correct field
          userUsageLimit: dto.userUsageLimit ?? null, // ← correct field
          validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(), // ← correct field
          validTo: dto.validTo
            ? new Date(dto.validTo)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          applicableToAll: !(dto.products?.length || dto.categories?.length),
          isActive: dto.isActive ?? true,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      if (dto.products?.length) {
        await tx.couponProduct.createMany({
          data: dto.products.map((productId) => ({
            couponId: coupon.id,
            productId,
            exclude: false,
          })),
        });
      }

      if (dto.categories?.length) {
        await tx.couponCategory.createMany({
          data: dto.categories.map((categoryId) => ({
            couponId: coupon.id,
            categoryId,
            exclude: false,
          })),
        });
      }

      this.logger.log(`Coupon created: ${coupon.code} by ${createdBy}`);
      return tx.coupon.findUniqueOrThrow({
        where: { id: coupon.id },
        include: {
          products: {
            include: {
              product: { select: { id: true, name: true, slug: true } },
            },
          },
          categories: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
    });
  }

  async findAll(dto: ListCouponsDto) {
    const now = new Date();
    const where: Prisma.CouponWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { code: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.activeOnly && {
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
          freeShipping: true,
          minOrderValue: true,
          maxOrderValue: true,
          usageLimit: true,
          userUsageLimit: true,
          used: true,
          validFrom: true,
          validTo: true,
          isActive: true,
          applicableToAll: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { products: true, categories: true, usages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.coupon.count({ where }),
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
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, price: true },
            },
          },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { usages: true } },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async findByCode(code: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), deletedAt: null },
      include: {
        products: { select: { productId: true, exclude: true } },
        categories: { select: { categoryId: true, exclude: true } },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async validateCoupon(dto: ValidateCouponDto): Promise<{
    valid: boolean;
    discountAmount?: number;
    discountType?: CouponDiscountType;
    discountValue?: number;
    freeShipping?: boolean;
    couponId?: string;
    message?: string;
  }> {
    const now = new Date();
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: dto.code.toUpperCase(), deletedAt: null },
      include: {
        products: { select: { productId: true, exclude: true } },
        categories: { select: { categoryId: true, exclude: true } },
      },
    });

    if (!coupon) return { valid: false, message: 'Invalid coupon code' };
    if (!coupon.isActive)
      return { valid: false, message: 'Coupon is not active' };
    if (coupon.validFrom > now)
      return { valid: false, message: 'Coupon is not yet valid' };
    if (coupon.validTo < now)
      return { valid: false, message: 'Coupon has expired' };
    if (coupon.usageLimit && coupon.used >= coupon.usageLimit)
      return { valid: false, message: 'Coupon usage limit reached' };
    if (
      coupon.minOrderValue &&
      dto.orderTotal < coupon.minOrderValue.toNumber()
    )
      return {
        valid: false,
        message: `Minimum order amount is ${coupon.minOrderValue.toNumber()}`,
      };
    if (
      coupon.maxOrderValue &&
      dto.orderTotal > coupon.maxOrderValue.toNumber()
    )
      return {
        valid: false,
        message: `Maximum order amount is ${coupon.maxOrderValue.toNumber()}`,
      };

    // Check per-customer usage limit
    if (coupon.userUsageLimit && dto.customerId) {
      const userUsage = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, customerId: dto.customerId },
      });
      if (userUsage >= coupon.userUsageLimit)
        return {
          valid: false,
          message:
            'You have already used this coupon the maximum number of times',
        };
    }

    // Product/category restriction checks
    if (!coupon.applicableToAll) {
      const includedProducts = coupon.products
        .filter((p) => !p.exclude)
        .map((p) => p.productId);
      const excludedProducts = coupon.products
        .filter((p) => p.exclude)
        .map((p) => p.productId);
      const includedCategories = coupon.categories
        .filter((c) => !c.exclude)
        .map((c) => c.categoryId);
      const excludedCategories = coupon.categories
        .filter((c) => c.exclude)
        .map((c) => c.categoryId);

      if (includedProducts.length && dto.productIds) {
        const hasMatch = includedProducts.some((id) =>
          dto.productIds!.includes(id),
        );
        if (!hasMatch)
          return {
            valid: false,
            message: 'Coupon not applicable to cart products',
          };
      }
      if (excludedProducts.length && dto.productIds) {
        const hasExcluded = excludedProducts.some((id) =>
          dto.productIds!.includes(id),
        );
        if (hasExcluded)
          return {
            valid: false,
            message: 'Coupon not valid for some products in cart',
          };
      }
      if (includedCategories.length && dto.categoryIds) {
        const hasMatch = includedCategories.some((id) =>
          dto.categoryIds!.includes(id),
        );
        if (!hasMatch)
          return {
            valid: false,
            message: 'Coupon not applicable to cart categories',
          };
      }
      if (excludedCategories.length && dto.categoryIds) {
        const hasExcluded = excludedCategories.some((id) =>
          dto.categoryIds!.includes(id),
        );
        if (hasExcluded)
          return {
            valid: false,
            message: 'Coupon not valid for some product categories',
          };
      }
    }

    const discountValue = coupon.discountValue.toNumber();
    let discountAmount = 0;
    if (coupon.discountType === CouponDiscountType.FIXED) {
      discountAmount = Math.min(discountValue, dto.orderTotal);
    } else {
      discountAmount = parseFloat(
        ((dto.orderTotal * discountValue) / 100).toFixed(4),
      );
    }

    return {
      valid: true,
      discountAmount,
      discountType: coupon.discountType,
      discountValue,
      freeShipping: coupon.freeShipping,
      couponId: coupon.id,
      message: 'Coupon applied successfully',
    };
  }

  async update(id: string, dto: UpdateCouponDto, updatedBy: string) {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!existing) throw new NotFoundException('Coupon not found');

    if (dto.code && dto.code.toUpperCase() !== existing.code) {
      const dup = await this.prisma.coupon.findFirst({
        where: {
          code: dto.code.toUpperCase(),
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Coupon code already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.code && { code: dto.code.toUpperCase() }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.discountType && { discountType: dto.discountType }),
          ...(dto.discountValue !== undefined && {
            discountValue: new Prisma.Decimal(dto.discountValue),
          }),
          ...(dto.freeShipping !== undefined && {
            freeShipping: dto.freeShipping,
          }),
          ...(dto.minOrderValue !== undefined && {
            minOrderValue:
              dto.minOrderValue != null
                ? new Prisma.Decimal(dto.minOrderValue)
                : null,
          }),
          ...(dto.maxOrderValue !== undefined && {
            maxOrderValue:
              dto.maxOrderValue != null
                ? new Prisma.Decimal(dto.maxOrderValue)
                : null,
          }),
          ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
          ...(dto.userUsageLimit !== undefined && {
            userUsageLimit: dto.userUsageLimit,
          }),
          ...(dto.validFrom !== undefined && {
            validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
          }),
          ...(dto.validTo !== undefined && {
            validTo: dto.validTo ? new Date(dto.validTo) : undefined,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.translations !== undefined && {
            translations: dto.translations as Prisma.InputJsonValue,
          }),
        },
      });

      if (dto.products !== undefined) {
        await tx.couponProduct.deleteMany({ where: { couponId: id } });
        if (dto.products.length) {
          await tx.couponProduct.createMany({
            data: dto.products.map((productId) => ({
              couponId: id,
              productId,
              exclude: false,
            })),
          });
        }
      }

      if (dto.categories !== undefined) {
        await tx.couponCategory.deleteMany({ where: { couponId: id } });
        if (dto.categories.length) {
          await tx.couponCategory.createMany({
            data: dto.categories.map((categoryId) => ({
              couponId: id,
              categoryId,
              exclude: false,
            })),
          });
        }
      }

      this.logger.log(`Coupon updated: ${id} by ${updatedBy}`);
      return tx.coupon.findUniqueOrThrow({
        where: { id },
        include: {
          products: {
            include: {
              product: { select: { id: true, name: true, slug: true } },
            },
          },
          categories: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
    });
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.prisma.softDelete('coupon', id, deletedBy);
    this.logger.log(`Coupon deleted: ${coupon.code} by ${deletedBy}`);
  }

  async incrementUsage(
    couponId: string,
    customerId: string | null,
    phone: string | null,
    orderId: string,
    discountApplied: number,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.coupon.update({
        where: { id: couponId },
        data: { used: { increment: 1 } },
      }),
      this.prisma.couponUsage.create({
        data: {
          couponId,
          customerId,
          phone,
          orderId,
          discountApplied: new Prisma.Decimal(discountApplied),
        },
      }),
    ]);
  }
}
