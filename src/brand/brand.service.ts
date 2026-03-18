// ─── src/brand/brand.service.ts ───────────────────────────────

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateBrandDto,
  UpdateBrandDto,
  ListBrandsDto,
  BulkDeleteBrandsDto,
} from './dto';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────
  // PRIVATE: link media to brand (with ref count)
  // ──────────────────────────────────────────────────────────
  private async linkMedia(tx: any, brandId: string, mediaId: string) {
    await tx.entityMedia.upsert({
      where: {
        entityType_entityId_mediaId: {
          entityType: 'Brand',
          entityId: brandId,
          mediaId,
        },
      },
      create: {
        entityType: 'Brand',
        entityId: brandId,
        mediaId,
        purpose: 'logo',
        isMain: true,
      },
      update: { isMain: true },
    });
    await tx.media.update({
      where: { id: mediaId },
      data: { referenceCount: { increment: 1 } },
    });
  }

  private async unlinkMedia(tx: any, brandId: string, mediaId: string) {
    await tx.entityMedia.deleteMany({
      where: { entityType: 'Brand', entityId: brandId, mediaId },
    });
    await tx.media.updateMany({
      where: { id: mediaId, referenceCount: { gt: 0 } },
      data: { referenceCount: { decrement: 1 } },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE BRAND
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateBrandDto, createdBy: string) {
    // Check slug uniqueness
    const existingSlug = await this.prisma.brand.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException({
        message: 'Brand with this slug already exists',
        field: 'slug',
        conflictingId: existingSlug.id,
      });
    }

    // Check name uniqueness (case-insensitive)
    const existingName = await this.prisma.brand.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingName) {
      throw new ConflictException({
        message: 'Brand with this name already exists',
        field: 'name',
        conflictingId: existingName.id,
      });
    }

    // Verify media exists if provided
    if (dto.image) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.image, deletedAt: null },
        select: { id: true },
      });
      if (!media)
        throw new BadRequestException({
          message: 'Media not found',
          field: 'image',
          mediaId: dto.image,
        });
    }

    const brand = await this.prisma.$transaction(async (tx) => {
      const b = await tx.brand.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          image: dto.image ?? null,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          seo: dto.seo ? (dto.seo as Prisma.InputJsonValue) : Prisma.JsonNull,
          createdBy,
        },
      });

      if (dto.image) {
        await this.linkMedia(tx, b.id, dto.image);
      }

      return b;
    });

    this.logger.log(
      `Brand created: "${brand.name}" (${brand.slug}) by ${createdBy}`,
    );
    return this.findOne(brand.id);
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL BRANDS
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListBrandsDto) {
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { slug: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.BrandOrderByWithRelationInput =
      dto.sortBy === 'name'
        ? { name: dto.sortOrder ?? 'asc' }
        : dto.sortBy === 'slug'
          ? { slug: dto.sortOrder ?? 'asc' }
          : { createdAt: dto.sortOrder ?? 'desc' };

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
          _count: { select: { products: true } },
        },
        orderBy,
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
        pageCount: Math.ceil(total / dto.take) || 1,
        hasMore: dto.skip + dto.take < total,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BRAND BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
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
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException({
        message: 'Brand not found',
        resourceId: id,
        resource: 'Brand',
      });
    }

    // Fetch linked media
    const media = await this.prisma.entityMedia.findMany({
      where: { entityType: 'Brand', entityId: id },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
            mimeType: true,
          },
        },
      },
      orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
    });

    return { ...brand, media };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BRAND BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { slug: slug.toLowerCase(), deletedAt: null },
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
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException({
        message: 'Brand not found',
        resourceSlug: slug,
        resource: 'Brand',
      });
    }

    const media = await this.prisma.entityMedia.findMany({
      where: { entityType: 'Brand', entityId: brand.id },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
            mimeType: true,
          },
        },
      },
      orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
    });

    return { ...brand, media };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BRAND STATS (Admin)
  // ══════════════════════════════════════════════════════════════
  async getStats(id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });

    if (!brand) {
      throw new NotFoundException({
        message: 'Brand not found',
        resourceId: id,
        resource: 'Brand',
      });
    }

    const [totalProducts, activeProducts, inactiveProducts] = await Promise.all(
      [
        this.prisma.product.count({ where: { brandId: id, deletedAt: null } }),
        this.prisma.product.count({
          where: { brandId: id, isActive: true, deletedAt: null },
        }),
        this.prisma.product.count({
          where: { brandId: id, isActive: false, deletedAt: null },
        }),
      ],
    );

    return {
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
      stats: { totalProducts, activeProducts, inactiveProducts },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE BRAND
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateBrandDto, updatedBy: string) {
    const existing = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, name: true, image: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Brand not found',
        resourceId: id,
        resource: 'Brand',
      });
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.brand.findFirst({
        where: { slug: dto.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (slugExists) {
        throw new ConflictException({
          message: 'Slug already taken',
          field: 'slug',
          conflictingId: slugExists.id,
        });
      }
    }

    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const nameExists = await this.prisma.brand.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (nameExists) {
        throw new ConflictException({
          message: 'Brand name already taken',
          field: 'name',
          conflictingId: nameExists.id,
        });
      }
    }

    if (dto.image && dto.image !== existing.image) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.image, deletedAt: null },
        select: { id: true },
      });
      if (!media)
        throw new BadRequestException({
          message: 'Media not found',
          field: 'image',
          mediaId: dto.image,
        });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.image !== undefined && { image: dto.image }),
          ...(dto.translations !== undefined && {
            translations: dto.translations as Prisma.InputJsonValue,
          }),
          ...(dto.seo !== undefined && {
            seo: dto.seo ? (dto.seo as Prisma.InputJsonValue) : Prisma.JsonNull,
          }),
          updatedBy,
        },
      });

      // Update media relationship if image changed
      if (dto.image !== undefined && dto.image !== existing.image) {
        if (existing.image) await this.unlinkMedia(tx, id, existing.image);
        if (dto.image) await this.linkMedia(tx, id, dto.image);
      }
    });

    this.logger.log(`Brand updated: "${existing.name}" by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE BRAND (SOFT)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, name: true, image: true },
    });

    if (!brand) {
      throw new NotFoundException({
        message: 'Brand not found',
        resourceId: id,
        resource: 'Brand',
      });
    }

    const activeProductCount = await this.prisma.product.count({
      where: { brandId: id, isActive: true, deletedAt: null },
    });

    if (activeProductCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete brand "${brand.name}". It has ${activeProductCount} active product(s). Deactivate or reassign them first.`,
        activeProductCount,
        brandName: brand.name,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).softDelete('brand', id, deletedBy);

      if (brand.image) {
        await this.unlinkMedia(tx, id, brand.image);
      }
    });

    this.logger.log(
      `Brand deleted: "${brand.name}" (${brand.slug}) by ${deletedBy}`,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // BULK DELETE
  // ══════════════════════════════════════════════════════════════
  async bulkDelete(dto: BulkDeleteBrandsDto, deletedBy: string) {
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of dto.ids) {
      try {
        await this.remove(id, deletedBy);
        results.push({ id, success: true });
      } catch (err: any) {
        const msg = err?.response?.message || err?.message || 'Unknown error';
        results.push({ id, success: false, error: msg });
      }
    }

    const deleted = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return { deleted, failed, results };
  }
}
