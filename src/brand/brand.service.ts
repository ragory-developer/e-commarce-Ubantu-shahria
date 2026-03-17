import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto, ListBrandsDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE BRAND
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateBrandDto, createdBy: string): Promise<object> {
    // Check if slug already exists
    const existingSlug = await this.prisma.brand.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException('Brand with this slug already exists');
    }

    // Verify media exists if image is provided
    if (dto.image) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.image, deletedAt: null },
        select: { id: true },
      });

      if (!media) {
        throw new BadRequestException('Invalid media ID');
      }
    }

    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        image: dto.image ?? null,
        translations:
          dto.translations !== undefined ? dto.translations : Prisma.JsonNull,
        seo: dto.seo !== undefined ? { ...dto.seo } : Prisma.JsonNull,
        createdBy: createdBy,
      },
    });

    // Link media to brand if image provided
    if (dto.image) {
      await this.prisma.entityMedia.create({
        data: {
          entityType: 'Brand',
          entityId: brand.id,
          mediaId: dto.image,
          purpose: 'logo',
          isMain: true,
        },
      });

      // Increment media reference count
      await this.prisma.media.update({
        where: { id: dto.image },
        data: { referenceCount: { increment: 1 } },
      });
    }

    this.logger.log(`Brand created: ${brand.slug} by ${createdBy}`);
    return brand;
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL BRANDS
  // ══════════════════════════════════════════════════════════════
  async findAll(
    dto: ListBrandsDto,
  ): Promise<{ data: object[]; total: number; meta: object }> {
    const where = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' as const } },
          { slug: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          translations: true,
          seo: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.brand.count({ where }),
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
  // GET BRAND BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string): Promise<object> {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        translations: true,
        seo: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        _count: {
          select: {
            product: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Get associated media
    const media = await this.prisma.entityMedia.findMany({
      where: {
        entityType: 'Brand',
        entityId: id,
      },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
          },
        },
      },
    });

    return { ...brand, media };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BRAND BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string): Promise<object> {
    const brand = await this.prisma.brand.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        translations: true,
        seo: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            product: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Get associated media
    const media = await this.prisma.entityMedia.findMany({
      where: {
        entityType: 'Brand',
        entityId: brand.id,
      },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
          },
        },
      },
    });

    return { ...brand, media };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE BRAND
  // ══════════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateBrandDto,
    updatedBy: string,
  ): Promise<object> {
    // Check if brand exists
    const existing = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, image: true },
    });

    if (!existing) {
      throw new NotFoundException('Brand not found');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.brand.findFirst({
        where: { slug: dto.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });

      if (slugExists) {
        throw new ConflictException('Brand with this slug already exists');
      }
    }

    // Verify new media if provided
    if (dto.image && dto.image !== existing.image) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.image, deletedAt: null },
        select: { id: true },
      });

      if (!media) {
        throw new BadRequestException('Invalid media ID');
      }
    }

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.translations !== undefined && {
          translations: dto.translations,
        }),
        ...(dto.seo !== undefined && {
          seo: dto.seo ? { ...dto.seo } : Prisma.JsonNull,
        }),
        updatedBy: updatedBy,
      },
    });

    // Update media relationship if image changed
    if (dto.image && dto.image !== existing.image) {
      // Remove old media link
      if (existing.image) {
        await this.prisma.entityMedia.deleteMany({
          where: {
            entityType: 'Brand',
            entityId: id,
            purpose: 'logo',
          },
        });

        // Decrement old media reference count
        await this.prisma.media.update({
          where: { id: existing.image },
          data: { referenceCount: { decrement: 1 } },
        });
      }

      // Add new media link
      await this.prisma.entityMedia.create({
        data: {
          entityType: 'Brand',
          entityId: id,
          mediaId: dto.image,
          purpose: 'logo',
          isMain: true,
        },
      });

      // Increment new media reference count
      await this.prisma.media.update({
        where: { id: dto.image },
        data: { referenceCount: { increment: 1 } },
      });
    }

    this.logger.log(`Brand updated: ${brand.slug} by ${updatedBy}`);
    return brand;
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE BRAND (SOFT DELETE)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, image: true },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Check if brand has active products
    const productCount = await this.prisma.product.count({
      where: { brandId: id, deletedAt: null },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete brand. ${productCount} products are using this brand`,
      );
    }

    // Soft delete brand
    await this.prisma.softDelete('brand', id, deletedBy);

    // Remove media relationships
    if (brand.image) {
      await this.prisma.entityMedia.deleteMany({
        where: {
          entityType: 'Brand',
          entityId: id,
        },
      });

      // Decrement media reference count
      await this.prisma.media.update({
        where: { id: brand.image },
        data: { referenceCount: { decrement: 1 } },
      });
    }

    this.logger.log(`Brand deleted: ${brand.slug} by ${deletedBy}`);
  }
}
