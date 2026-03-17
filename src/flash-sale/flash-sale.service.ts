import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  // ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  ListFlashSalesDto,
} from './dto';

@Injectable()
export class FlashSaleService {
  private readonly logger = new Logger(FlashSaleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE FLASH SALE
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateFlashSaleDto, createdBy: string): Promise<object> {
    // Verify all products exist
    const productIds = dto.products.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create flash sale
      const flashSale = await tx.flashSale.create({
        data: {
          campaignName: dto.campaignName,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          createdBy,
        },
        select: {
          id: true,
          campaignName: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create flash sale products
      const flashSaleProducts = await Promise.all(
        dto.products.map((product, index) =>
          tx.flashSaleProduct.create({
            data: {
              flashSaleId: flashSale.id,
              productId: product.productId,
              price: product.price,
              qty: product.qty,
              sold: 0,
              endDate: new Date(product.endDate),
              position: product.position ?? index,
              createdBy,
            },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                },
              },
            },
          }),
        ),
      );

      this.logger.log(
        `Flash sale created: ${flashSale.campaignName} with ${flashSaleProducts.length} products by ${createdBy}`,
      );

      return {
        ...flashSale,
        products: flashSaleProducts,
      };
    });
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL FLASH SALES
  // ══════════════════════════════════════════════════════════════
  async findAll(
    dto: ListFlashSalesDto,
  ): Promise<{ data: object[]; total: number; meta: object }> {
    const where: Prisma.FlashSaleWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        campaignName: { contains: dto.search, mode: 'insensitive' },
      }),
    };

    // If activeOnly, filter products with endDate > now
    const [data, total] = await Promise.all([
      this.prisma.flashSale.findMany({
        where,
        select: {
          id: true,
          campaignName: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: {
                where: {
                  deletedAt: null,
                  ...(dto.activeOnly && {
                    endDate: { gt: new Date() },
                    qty: { gt: 0 },
                  }),
                },
              },
            },
          },
          products: {
            where: {
              deletedAt: null,
              ...(dto.activeOnly && {
                endDate: { gt: new Date() },
                qty: { gt: 0 },
              }),
            },
            select: {
              id: true,
              productId: true,
              price: true,
              qty: true,
              sold: true,
              endDate: true,
              position: true,
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
            take: 10, // Limit products per flash sale in list view
          },
        },
        orderBy: { createdAt: 'desc' },
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

  // ══════════════════════════════════════════════════════════════
  // GET ACTIVE FLASH SALES (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  async findActive(): Promise<
    Prisma.FlashSaleGetPayload<{
      select: {
        id: true;
        campaignName: true;
        translations: true;
        products: {
          select: {
            id: true;
            productId: true;
            price: true;
            qty: true;
            sold: true;
            endDate: true;
            position: true;
            product: {
              select: {
                id: true;
                name: true;
                slug: true;
                price: true;
                images: true;
              };
            };
          };
        };
      };
    }>[]
  > {
    const now = new Date();

    return this.prisma.flashSale.findMany({
      where: {
        deletedAt: null,
        products: {
          some: {
            deletedAt: null,
            endDate: { gt: now },
            qty: { gt: 0 },
          },
        },
      },
      select: {
        id: true,
        campaignName: true,
        translations: true,
        products: {
          where: {
            deletedAt: null,
            endDate: { gt: now },
            qty: { gt: 0 },
          },
          select: {
            id: true,
            productId: true,
            price: true,
            qty: true,
            sold: true,
            endDate: true,
            position: true,
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
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // GET FLASH SALE BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string): Promise<object> {
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

    if (!flashSale) {
      throw new NotFoundException('Flash sale not found');
    }

    return flashSale;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE FLASH SALE
  // ══════════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateFlashSaleDto,
    updatedBy: string,
  ): Promise<any> {
    const existing = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Flash sale not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update flash sale
      await tx.flashSale.update({
        where: { id },
        data: {
          ...(dto.campaignName && { campaignName: dto.campaignName }),
          ...(dto.translations !== undefined && {
            translations: dto.translations as Prisma.InputJsonValue,
          }),
          updatedBy,
        },
      });

      // Replace products if provided
      if (dto.products?.length) {
        const productIds = dto.products.map((p) => p.productId);

        const products = await tx.product.findMany({
          where: { id: { in: productIds }, deletedAt: null },
          select: { id: true },
        });

        if (products.length !== productIds.length) {
          throw new NotFoundException('One or more products not found');
        }

        // Soft delete old flash sale products
        await tx.flashSaleProduct.updateMany({
          where: { flashSaleId: id, deletedAt: null },
          data: {
            deletedAt: new Date(),
            deletedBy: updatedBy,
          },
        });

        // Insert new products
        await Promise.all(
          dto.products.map((product, index) =>
            tx.flashSaleProduct.create({
              data: {
                flashSaleId: id,
                productId: product.productId,
                price: product.price,
                qty: product.qty,
                sold: 0,
                endDate: new Date(product.endDate),
                position: product.position ?? index,
                createdBy: updatedBy,
              },
            }),
          ),
        );
      }

      // Fetch updated flash sale safely
      const updated = await tx.flashSale.findUniqueOrThrow({
        where: { id },
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
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });

      this.logger.log(`Flash sale updated: ${id} by ${updatedBy}`);

      return updated;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE FLASH SALE (SOFT DELETE)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const flashSale = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, campaignName: true },
    });

    if (!flashSale) {
      throw new NotFoundException('Flash sale not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft delete flash sale products
      await tx.flashSaleProduct.updateMany({
        where: { flashSaleId: id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          deletedBy,
        },
      });

      // Soft delete flash sale
      await tx.flashSale.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy,
        },
      });
    });

    this.logger.log(
      `Flash sale deleted: ${flashSale.campaignName} by ${deletedBy}`,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // INCREMENT SOLD COUNT (called by OrderService)
  // ══════════════════════════════════════════════════════════════
  async incrementSold(
    flashSaleProductId: string,
    quantity: number,
  ): Promise<void> {
    const flashSaleProduct = await this.prisma.flashSaleProduct.findFirst({
      where: { id: flashSaleProductId, deletedAt: null },
      select: { id: true, qty: true, sold: true },
    });

    if (!flashSaleProduct) {
      throw new NotFoundException('Flash sale product not found');
    }

    if (flashSaleProduct.sold + quantity > flashSaleProduct.qty) {
      throw new BadRequestException('Not enough quantity available');
    }

    await this.prisma.flashSaleProduct.update({
      where: { id: flashSaleProductId },
      data: {
        sold: { increment: quantity },
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // CHECK AVAILABILITY (called by OrderService)
  // ══════════════════════════════════════════════════════════════
  async checkAvailability(
    productId: string,
    quantity: number,
  ): Promise<{
    available: boolean;
    flashSaleProduct?: any;
    message?: string;
  }> {
    const now = new Date();

    const flashSaleProduct = await this.prisma.flashSaleProduct.findFirst({
      where: {
        productId,
        deletedAt: null,
        endDate: { gt: now },
        flashSale: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        price: true,
        qty: true,
        sold: true,
        endDate: true,
      },
      orderBy: { endDate: 'asc' }, // Get the earliest ending sale
    });

    if (!flashSaleProduct) {
      return {
        available: false,
        message: 'No active flash sale for this product',
      };
    }

    const availableQty = flashSaleProduct.qty - flashSaleProduct.sold;

    if (availableQty < quantity) {
      return {
        available: false,
        flashSaleProduct,
        message: `Only ${availableQty} items available in flash sale`,
      };
    }

    return {
      available: true,
      flashSaleProduct,
    };
  }
}
