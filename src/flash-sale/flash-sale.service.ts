import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, FlashSaleStatus } from '@prisma/client';
import {
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  ListFlashSalesDto,
} from './dto';

@Injectable()
export class FlashSaleService {
  private readonly logger = new Logger(FlashSaleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFlashSaleDto, createdBy: string) {
    // Validate time range
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime)
      throw new BadRequestException('endTime must be after startTime');

    // Check for overlapping active flash sales
    const overlap = await this.prisma.flashSale.findFirst({
      where: {
        deletedAt: null,
        status: { in: [FlashSaleStatus.SCHEDULED, FlashSaleStatus.ACTIVE] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true, name: true },
    });
    if (overlap)
      throw new ConflictException(
        `Overlaps with existing flash sale "${overlap.name}". Adjust time range.`,
      );

    const productIds = dto.products.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      select: { id: true, name: true, price: true },
    });
    if (products.length !== productIds.length)
      throw new NotFoundException('One or more products not found');

    return this.prisma.$transaction(async (tx) => {
      const flashSale = await tx.flashSale.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          startTime,
          endTime,
          status:
            startTime <= new Date()
              ? FlashSaleStatus.ACTIVE
              : FlashSaleStatus.SCHEDULED,
          discountType: dto.discountType ?? 'PERCENT',
          discountValue: new Prisma.Decimal(dto.discountValue ?? 0),
          isActive: true,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          createdBy,
        },
      });

      for (let i = 0; i < dto.products.length; i++) {
        const p = dto.products[i];
        const product = products.find((x) => x.id === p.productId)!;

        // Validate price is lower than regular price
        if (product.price && p.price >= product.price.toNumber()) {
          throw new BadRequestException(
            `Flash sale price for "${product.name}" must be lower than regular price ${product.price.toNumber()}`,
          );
        }

        await tx.flashSaleProduct.create({
          data: {
            flashSaleId: flashSale.id,
            productId: p.productId,
            productVariantId: p.productVariantId ?? null,
            price: new Prisma.Decimal(p.price),
            qty: p.qty,
            sold: 0,
            reserved: 0,
            position: p.position ?? i,
            isActive: true,
            createdBy,
          },
        });
      }

      this.logger.log(`Flash sale created: ${flashSale.name} by ${createdBy}`);
      return tx.flashSale.findUniqueOrThrow({
        where: { id: flashSale.id },
        include: {
          products: {
            where: { deletedAt: null },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  images: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
    });
  }

  async findAll(dto: ListFlashSalesDto) {
    const where: Prisma.FlashSaleWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        name: { contains: dto.search, mode: 'insensitive' },
      }),
      ...(dto.status && { status: dto.status }),
      ...(dto.activeOnly && { status: FlashSaleStatus.ACTIVE, isActive: true }),
    };

    const [data, total] = await Promise.all([
      this.prisma.flashSale.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startTime: true,
          endTime: true,
          discountType: true,
          discountValue: true,
          isActive: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: { where: { deletedAt: null, isActive: true } },
            },
          },
        },
        orderBy: { startTime: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.flashSale.count({ where }),
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
    const flashSale = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      include: {
        products: {
          where: { deletedAt: null },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: true,
                inStock: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!flashSale) throw new NotFoundException('Flash sale not found');
    return flashSale;
  }

  async findActive() {
    const now = new Date();
    return this.prisma.flashSale.findMany({
      where: {
        deletedAt: null,
        status: FlashSaleStatus.ACTIVE,
        isActive: true,
        startTime: { lte: now },
        endTime: { gt: now },
      },
      include: {
        products: {
          where: {
            deletedAt: null,
            isActive: true,
            // Only show items with remaining stock
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { endTime: 'asc' }, // soonest-ending first
    });
  }

  async update(id: string, dto: UpdateFlashSaleDto, updatedBy: string) {
    const existing = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Flash sale not found');
    if (existing.status === FlashSaleStatus.ENDED)
      throw new BadRequestException('Cannot edit an ended flash sale');

    return this.prisma.$transaction(async (tx) => {
      const startTime = dto.startTime ? new Date(dto.startTime) : undefined;
      const endTime = dto.endTime ? new Date(dto.endTime) : undefined;
      if (startTime && endTime && endTime <= startTime)
        throw new BadRequestException('endTime must be after startTime');

      await tx.flashSale.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(dto.discountType && { discountType: dto.discountType }),
          ...(dto.discountValue !== undefined && {
            discountValue: new Prisma.Decimal(dto.discountValue),
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.translations !== undefined && {
            translations: dto.translations as Prisma.InputJsonValue,
          }),
          updatedBy,
        },
      });

      if (dto.products?.length) {
        await tx.flashSaleProduct.updateMany({
          where: { flashSaleId: id, deletedAt: null },
          data: { deletedAt: new Date(), deletedBy: updatedBy },
        });
        for (let i = 0; i < dto.products.length; i++) {
          const p = dto.products[i];
          await tx.flashSaleProduct.create({
            data: {
              flashSaleId: id,
              productId: p.productId,
              productVariantId: p.productVariantId ?? null,
              price: new Prisma.Decimal(p.price),
              qty: p.qty,
              sold: 0,
              reserved: 0,
              position: p.position ?? i,
              isActive: true,
              createdBy: updatedBy,
            },
          });
        }
      }

      this.logger.log(`Flash sale updated: ${id} by ${updatedBy}`);
      return tx.flashSale.findUniqueOrThrow({
        where: { id },
        include: {
          products: {
            where: { deletedAt: null },
            include: {
              product: {
                select: { id: true, name: true, slug: true, price: true },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
    });
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    const flashSale = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!flashSale) throw new NotFoundException('Flash sale not found');
    if (flashSale.status === FlashSaleStatus.ACTIVE)
      throw new BadRequestException(
        'Cannot delete an active flash sale. Cancel it first.',
      );

    await this.prisma.$transaction([
      this.prisma.flashSaleProduct.updateMany({
        where: { flashSaleId: id, deletedAt: null },
        data: { deletedAt: new Date(), deletedBy },
      }),
      this.prisma.flashSale.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy },
      }),
    ]);
    this.logger.log(`Flash sale deleted: ${flashSale.name} by ${deletedBy}`);
  }

  async updateStatus(id: string, status: FlashSaleStatus, updatedBy: string) {
    const flashSale = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!flashSale) throw new NotFoundException('Flash sale not found');

    await this.prisma.flashSale.update({
      where: { id },
      data: { status, updatedBy },
    });
    this.logger.log(`Flash sale ${id} status → ${status} by ${updatedBy}`);
  }

  async checkAvailability(
    productId: string,
    variantId: string | null,
    quantity: number,
  ) {
    const now = new Date();
    const item = await this.prisma.flashSaleProduct.findFirst({
      where: {
        productId,
        productVariantId: variantId,
        deletedAt: null,
        isActive: true,
        flashSale: {
          deletedAt: null,
          status: FlashSaleStatus.ACTIVE,
          startTime: { lte: now },
          endTime: { gt: now },
        },
      },
      select: { id: true, price: true, qty: true, sold: true, reserved: true },
      orderBy: { price: 'asc' },
    });

    if (!item) return { available: false };
    const remaining = item.qty - item.sold - item.reserved;
    if (remaining < quantity)
      return { available: false, remaining, flashSaleProductId: item.id };
    return {
      available: true,
      price: item.price,
      remaining,
      flashSaleProductId: item.id,
    };
  }

  async reserveStock(
    flashSaleProductId: string,
    quantity: number,
  ): Promise<void> {
    await this.prisma.flashSaleProduct.update({
      where: { id: flashSaleProductId },
      data: { reserved: { increment: quantity } },
    });
  }

  async incrementSold(
    flashSaleProductId: string,
    quantity: number,
  ): Promise<void> {
    await this.prisma.flashSaleProduct.update({
      where: { id: flashSaleProductId },
      data: {
        sold: { increment: quantity },
        reserved: { decrement: quantity },
      },
    });
  }
}
