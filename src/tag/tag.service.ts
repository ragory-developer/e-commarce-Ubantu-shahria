// ─── src/tag/tag.service.ts ───────────────────────────────────

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
  CreateTagDto,
  UpdateTagDto,
  ListTagsDto,
  BulkDeleteTagsDto,
} from './dto';

@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE TAG
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateTagDto, createdBy: string) {
    // Check slug uniqueness (case-insensitive)
    const existingSlug = await this.prisma.tag.findFirst({
      where: { slug: dto.slug.toLowerCase(), deletedAt: null },
      select: { id: true, slug: true },
    });

    if (existingSlug) {
      throw new ConflictException({
        message: 'Tag with this slug already exists',
        field: 'slug',
        conflictingId: existingSlug.id,
      });
    }

    // Check name uniqueness (case-insensitive)
    const existingName = await this.prisma.tag.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingName) {
      throw new ConflictException({
        message: 'Tag with this name already exists',
        field: 'name',
        conflictingId: existingName.id,
      });
    }

    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdBy,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        _count: { select: { products: true } },
      },
    });

    this.logger.log(`Tag created: "${tag.name}" (${tag.slug}) by ${createdBy}`);
    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL TAGS (paginated + search + sort)
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListTagsDto) {
    const where: Prisma.TagWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { slug: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Build orderBy
    const orderBy: Prisma.TagOrderByWithRelationInput =
      dto.sortBy === 'name'
        ? { name: dto.sortOrder ?? 'asc' }
        : dto.sortBy === 'slug'
          ? { slug: dto.sortOrder ?? 'asc' }
          : { createdAt: dto.sortOrder ?? 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { products: true } },
        },
        orderBy,
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.tag.count({ where }),
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
  // GET TAG BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        _count: { select: { products: true } },
      },
    });

    if (!tag) {
      throw new NotFoundException({
        message: 'Tag not found',
        resourceId: id,
        resource: 'Tag',
      });
    }

    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { slug: slug.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    });

    if (!tag) {
      throw new NotFoundException({
        message: 'Tag not found',
        resourceSlug: slug,
        resource: 'Tag',
      });
    }

    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // GET POPULAR TAGS (by product count)
  // ══════════════════════════════════════════════════════════════
  async findPopular(limit: number = 20) {
    // Fetch all active tags with product counts, sort by count desc
    const tags = await this.prisma.tag.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        _count: { select: { products: true } },
      },
      orderBy: { products: { _count: 'desc' } },
      take: Math.min(limit, 100),
    });

    return tags;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE TAG
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateTagDto, updatedBy: string) {
    const existing = await this.prisma.tag.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Tag not found',
        resourceId: id,
        resource: 'Tag',
      });
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug.toLowerCase() !== existing.slug) {
      const slugExists = await this.prisma.tag.findFirst({
        where: {
          slug: dto.slug.toLowerCase(),
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });

      if (slugExists) {
        throw new ConflictException({
          message: 'Tag with this slug already exists',
          field: 'slug',
          conflictingId: slugExists.id,
        });
      }
    }

    // Check name uniqueness if changing
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const nameExists = await this.prisma.tag.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });

      if (nameExists) {
        throw new ConflictException({
          message: 'Tag with this name already exists',
          field: 'name',
          conflictingId: nameExists.id,
        });
      }
    }

    const tag = await this.prisma.tag.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug.toLowerCase() }),
        ...(dto.translations !== undefined && {
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
        updatedBy,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    });

    this.logger.log(`Tag updated: "${tag.name}" (${tag.slug}) by ${updatedBy}`);
    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE TAG (SOFT)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, name: true },
    });

    if (!tag) {
      throw new NotFoundException({
        message: 'Tag not found',
        resourceId: id,
        resource: 'Tag',
      });
    }

    const productCount = await this.prisma.productTag.count({
      where: { tagId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete tag "${tag.name}". It is assigned to ${productCount} product(s). Remove it from products first.`,
        productCount,
        tagName: tag.name,
      });
    }

    await this.prisma.softDelete('tag', id, deletedBy);
    this.logger.log(`Tag deleted: "${tag.name}" (${tag.slug}) by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // BULK DELETE TAGS
  // ══════════════════════════════════════════════════════════════
  async bulkDelete(dto: BulkDeleteTagsDto, deletedBy: string) {
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of dto.ids) {
      try {
        await this.remove(id, deletedBy);
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({
          id,
          success: false,
          error: err?.response?.message || err.message,
        });
      }
    }

    const deleted = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { deleted, failed, results };
  }
}
