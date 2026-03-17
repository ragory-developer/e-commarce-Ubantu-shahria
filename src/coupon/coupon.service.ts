import {
  Injectable,
  NotFoundException,
  // BadRequestException,
  ConflictException,
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

  // ══════════════════════════════════════════════════════════════
  // CREATE COUPON
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateCouponDto, createdBy: string): Promise<any> {
    // Check code uniqueness
    const existingCode = await this.prisma.coupon.findFirst({
      where: { code: dto.code, deletedAt: null },
      select: { id: true },
    });

    if (existingCode) {
      throw new ConflictException('Coupon code already exists');
    }

    // Verify products exist if provided
    if (dto.products?.length) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: dto.products }, deletedAt: null },
        select: { id: true },
      });

      if (products.length !== dto.products.length) {
        throw new NotFoundException('One or more products not found');
      }
    }

    // Verify categories exist if provided
    if (dto.categories?.length) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: dto.categories }, deletedAt: null },
        select: { id: true },
      });

      if (categories.length !== dto.categories.length) {
        throw new NotFoundException('One or more categories not found');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Create coupon
      const coupon = await tx.coupon.create({
        data: {
          name: dto.name,
          code: dto.code,
          discountType: dto.discountType,
          value: dto.value,
          freeShipping: dto.freeShipping ?? false,
          minimumSpend: dto.minimumSpend ?? null,
          maximumSpend: dto.maximumSpend ?? null,
          usageLimitPerCoupon: dto.usageLimitPerCoupon ?? null,
          usageLimitPerCustomer: dto.usageLimitPerCustomer ?? null,
          isActive: dto.isActive ?? true,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      // Link products
      if (dto.products?.length) {
        await tx.couponProduct.createMany({
          data: dto.products.map((productId) => ({
            couponId: coupon.id,
            productId,
            exclude: false,
          })),
        });
      }

      // Link categories
      if (dto.categories?.length) {
        await tx.couponCategory.createMany({
          data: dto.categories.map((categoryId) => ({
            couponId: coupon.id,
            categoryId,
            exclude: false,
          })),
        });
      }

      // Fetch complete coupon safely
      const complete = await tx.coupon.findUniqueOrThrow({
        where: { id: coupon.id },
        include: {
          products: {
            select: {
              productId: true,
              exclude: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          categories: {
            select: {
              categoryId: true,
              exclude: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Coupon created: ${coupon.code} by ${createdBy}`);

      return complete;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL COUPONS
  // ══════════════════════════════════════════════════════════════
  async findAll(
    dto: ListCouponsDto,
  ): Promise<{ data: object[]; total: number; meta: object }> {
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
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          discountType: true,
          value: true,
          freeShipping: true,
          minimumSpend: true,
          maximumSpend: true,
          usageLimitPerCoupon: true,
          usageLimitPerCustomer: true,
          used: true,
          isActive: true,
          startDate: true,
          endDate: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: true,
              categories: true,
            },
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

  // ══════════════════════════════════════════════════════════════
  // GET COUPON BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string): Promise<object> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      include: {
        products: {
          select: {
            productId: true,
            exclude: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
              },
            },
          },
        },
        categories: {
          select: {
            categoryId: true,
            exclude: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  // ══════════════════════════════════════════════════════════════
  // GET COUPON BY CODE
  // ══════════════════════════════════════════════════════════════
  async findByCode(code: string): Promise<object> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), deletedAt: null },
      include: {
        products: {
          select: {
            productId: true,
            exclude: true,
          },
        },
        categories: {
          select: {
            categoryId: true,
            exclude: true,
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  // ══════════════════════════════════════════════════════════════
  // VALIDATE COUPON (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  async validateCoupon(dto: ValidateCouponDto): Promise<{
    valid: boolean;
    discount?: number;
    freeShipping?: boolean;
    message?: string;
  }> {
    const now = new Date();

    // Find coupon
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: dto.code, deletedAt: null },
      include: {
        products: {
          select: {
            productId: true,
            exclude: true,
          },
        },
        categories: {
          select: {
            categoryId: true,
            exclude: true,
          },
        },
      },
    });

    if (!coupon) {
      return { valid: false, message: 'Invalid coupon code' };
    }

    // Check if active
    if (!coupon.isActive) {
      return { valid: false, message: 'Coupon is not active' };
    }

    // Check date range
    if (coupon.startDate && coupon.startDate > now) {
      return { valid: false, message: 'Coupon not yet valid' };
    }

    if (coupon.endDate && coupon.endDate < now) {
      return { valid: false, message: 'Coupon has expired' };
    }

    // Check usage limit
    if (
      coupon.usageLimitPerCoupon &&
      coupon.used >= coupon.usageLimitPerCoupon
    ) {
      return { valid: false, message: 'Coupon usage limit reached' };
    }

    // Check minimum spend
    if (
      coupon.minimumSpend &&
      dto.orderTotal < coupon.minimumSpend.toNumber()
    ) {
      return {
        valid: false,
        message: `Minimum order amount is ${coupon.minimumSpend.toNumber()}`,
      };
    }

    // Check maximum spend
    if (
      coupon.maximumSpend &&
      dto.orderTotal > coupon.maximumSpend.toNumber()
    ) {
      return {
        valid: false,
        message: `Maximum order amount is ${coupon.maximumSpend.toNumber()}`,
      };
    }

    // Check product restrictions
    if (coupon.products.length > 0 && dto.productIds) {
      const includedProducts = coupon.products.filter((p) => !p.exclude);
      const excludedProducts = coupon.products.filter((p) => p.exclude);

      // If there are included products, at least one must be in cart
      if (includedProducts.length > 0) {
        const hasIncluded = includedProducts.some((p) =>
          dto.productIds!.includes(p.productId),
        );
        if (!hasIncluded) {
          return {
            valid: false,
            message: 'Coupon not applicable to products in cart',
          };
        }
      }

      // If there are excluded products, none should be in cart
      if (excludedProducts.length > 0) {
        const hasExcluded = excludedProducts.some((p) =>
          dto.productIds!.includes(p.productId),
        );
        if (hasExcluded) {
          return {
            valid: false,
            message: 'Coupon not valid for some products in cart',
          };
        }
      }
    }

    // Check category restrictions
    if (coupon.categories.length > 0 && dto.categoryIds) {
      const includedCategories = coupon.categories.filter((c) => !c.exclude);
      const excludedCategories = coupon.categories.filter((c) => c.exclude);

      if (includedCategories.length > 0) {
        const hasIncluded = includedCategories.some((c) =>
          dto.categoryIds!.includes(c.categoryId),
        );
        if (!hasIncluded) {
          return {
            valid: false,
            message: 'Coupon not applicable to product categories in cart',
          };
        }
      }

      if (excludedCategories.length > 0) {
        const hasExcluded = excludedCategories.some((c) =>
          dto.categoryIds!.includes(c.categoryId),
        );
        if (hasExcluded) {
          return {
            valid: false,
            message: 'Coupon not valid for some product categories in cart',
          };
        }
      }
    }

    // TODO: Check per-customer usage limit (requires order history)
    // if (coupon.usageLimitPerCustomer && dto.customerId) {
    //   const customerUsage = await this.prisma.order.count({
    //     where: {
    //       customerId: dto.customerId,
    //       couponCode: coupon.code,
    //     },
    //   });
    //   if (customerUsage >= coupon.usageLimitPerCustomer) {
    //     return { valid: false, message: 'You have already used this coupon' };
    //   }
    // }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === CouponDiscountType.FIXED) {
      discount = Number(coupon.value);
    } else if (coupon.discountType === CouponDiscountType.PERCENT) {
      discount = (dto.orderTotal * Number(coupon.value)) / 100;
    }

    return {
      valid: true,
      discount,
      freeShipping: coupon.freeShipping,
      message: 'Coupon applied successfully',
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE COUPON
  // ══════════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateCouponDto,
    updatedBy: string,
  ): Promise<object> {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });

    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    // Check code uniqueness if changing
    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.prisma.coupon.findFirst({
        where: { code: dto.code, deletedAt: null, id: { not: id } },
        select: { id: true },
      });

      if (codeExists) {
        throw new ConflictException('Coupon code already exists');
      }
    }

    // Verify products if provided
    if (dto.products?.length) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: dto.products }, deletedAt: null },
        select: { id: true },
      });

      if (products.length !== dto.products.length) {
        throw new NotFoundException('One or more products not found');
      }
    }

    // Verify categories if provided
    if (dto.categories?.length) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: dto.categories }, deletedAt: null },
        select: { id: true },
      });

      if (categories.length !== dto.categories.length) {
        throw new NotFoundException('One or more categories not found');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.code && { code: dto.code }),
          ...(dto.discountType && { discountType: dto.discountType }),
          ...(dto.value !== undefined && { value: dto.value }),
          ...(dto.freeShipping !== undefined && {
            freeShipping: dto.freeShipping,
          }),
          ...(dto.minimumSpend !== undefined && {
            minimumSpend: dto.minimumSpend,
          }),
          ...(dto.maximumSpend !== undefined && {
            maximumSpend: dto.maximumSpend,
          }),
          ...(dto.usageLimitPerCoupon !== undefined && {
            usageLimitPerCoupon: dto.usageLimitPerCoupon,
          }),
          ...(dto.usageLimitPerCustomer !== undefined && {
            usageLimitPerCustomer: dto.usageLimitPerCustomer,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.startDate !== undefined && {
            startDate: dto.startDate ? new Date(dto.startDate) : null,
          }),
          ...(dto.endDate !== undefined && {
            endDate: dto.endDate ? new Date(dto.endDate) : null,
          }),
          ...(dto.translations !== undefined && {
            translations: dto.translations as Prisma.InputJsonValue,
          }),
        },
      });

      if (dto.products !== undefined) {
        await tx.couponProduct.deleteMany({
          where: { couponId: id },
        });

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
        await tx.couponCategory.deleteMany({
          where: { couponId: id },
        });

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

      const updated = await tx.coupon.findUniqueOrThrow({
        where: { id },
        include: {
          products: {
            select: {
              productId: true,
              exclude: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          categories: {
            select: {
              categoryId: true,
              exclude: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Coupon updated: ${id} by ${updatedBy}`);

      return updated;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE COUPON (SOFT DELETE)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.prisma.softDelete('coupon', id, deletedBy);

    this.logger.log(`Coupon deleted: ${coupon.code} by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // INCREMENT USAGE (called by OrderService)
  // ══════════════════════════════════════════════════════════════
  async incrementUsage(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        used: { increment: 1 },
      },
    });
  }
}
