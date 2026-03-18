// ─── src/attribute/attribute-set.service.ts ──────────────────

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
  CreateAttributeSetDto,
  UpdateAttributeSetDto,
  ListAttributeSetsDto,
} from './dto';

@Injectable()
export class AttributeSetService {
  private readonly logger = new Logger(AttributeSetService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE ATTRIBUTE SET
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateAttributeSetDto, createdBy: string) {
    const existingSlug = await this.prisma.attributeSet.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException({
        message: 'Attribute set with this slug already exists',
        field: 'slug',
        conflictingId: existingSlug.id,
      });
    }

    const existingName = await this.prisma.attributeSet.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingName) {
      throw new ConflictException({
        message: 'Attribute set with this name already exists',
        field: 'name',
        conflictingId: existingName.id,
      });
    }

    const attributeSet = await this.prisma.attributeSet.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { attributes: true } },
      },
    });

    this.logger.log(
      `AttributeSet created: "${attributeSet.name}" by ${createdBy}`,
    );
    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // LIST ATTRIBUTE SETS
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListAttributeSetsDto) {
    const where: Prisma.AttributeSetWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { slug: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.attributeSet.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { attributes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.attributeSet.count({ where }),
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
  // GET BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { id, deletedAt: null },
      include: {
        attributes: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            position: true,
            translations: true,
            createdAt: true,
            _count: { select: { values: true, productAttributes: true } },
            values: {
              where: { deletedAt: null },
              select: {
                id: true,
                value: true,
                label: true,
                hexColor: true,
                position: true,
                translations: true,
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!attributeSet) {
      throw new NotFoundException({
        message: 'Attribute set not found',
        resourceId: id,
      });
    }

    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // GET BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string) {
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { slug, deletedAt: null },
      include: {
        attributes: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            position: true,
            translations: true,
            values: {
              where: { deletedAt: null },
              select: {
                id: true,
                value: true,
                label: true,
                hexColor: true,
                position: true,
                translations: true,
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!attributeSet) {
      throw new NotFoundException({
        message: 'Attribute set not found',
        resourceSlug: slug,
      });
    }

    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateAttributeSetDto, updatedBy: string) {
    const existing = await this.prisma.attributeSet.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Attribute set not found',
        resourceId: id,
      });
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.attributeSet.findFirst({
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
      const nameExists = await this.prisma.attributeSet.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (nameExists) {
        throw new ConflictException({
          message: 'Name already taken',
          field: 'name',
          conflictingId: nameExists.id,
        });
      }
    }

    const updated = await this.prisma.attributeSet.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(`AttributeSet updated: "${updated.name}" by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const existing = await this.prisma.attributeSet.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Attribute set not found',
        resourceId: id,
      });
    }

    const attributeCount = await this.prisma.attribute.count({
      where: { attributeSetId: id, deletedAt: null },
    });

    if (attributeCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete attribute set "${existing.name}". It contains ${attributeCount} attribute(s). Delete all attributes first.`,
        attributeCount,
      });
    }

    await this.prisma.softDelete('attributeSet', id, deletedBy);
    this.logger.log(`AttributeSet deleted: "${existing.name}" by ${deletedBy}`);
  }
}
