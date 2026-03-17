import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateTagDto, UpdateTagDto, ListTagsDto } from './dto';

@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE TAG
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateTagDto, createdBy: string): Promise<object> {
    const existingSlug = await this.prisma.tag.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException('Tag with this slug already exists');
    }

    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        translations:
          dto.translations !== undefined
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
      },
    });

    this.logger.log(`Tag created: ${tag.slug} by ${createdBy}`);

    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL TAGS
  // ══════════════════════════════════════════════════════════════
  async findAll(
    dto: ListTagsDto,
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
      this.prisma.tag.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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
        pageCount: Math.ceil(total / dto.take),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string): Promise<object> {
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
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string): Promise<object> {
    const tag = await this.prisma.tag.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE TAG
  // ══════════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateTagDto,
    updatedBy: string,
  ): Promise<object> {
    const existing = await this.prisma.tag.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new NotFoundException('Tag not found');
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.tag.findFirst({
        where: {
          slug: dto.slug,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });

      if (slugExists) {
        throw new ConflictException('Tag with this slug already exists');
      }
    }

    const tag = await this.prisma.tag.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
        updatedBy,
      },
    });

    this.logger.log(`Tag updated: ${tag.slug} by ${updatedBy}`);

    return tag;
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE TAG (SOFT DELETE)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    const productCount = await this.prisma.productTag.count({
      where: { tagId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete tag. ${productCount} products are using this tag`,
      );
    }

    await this.prisma.softDelete('tag', id, deletedBy);

    this.logger.log(`Tag deleted: ${tag.slug} by ${deletedBy}`);
  }
}
