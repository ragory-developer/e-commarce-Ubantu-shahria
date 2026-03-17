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
  async create(dto: CreateAttributeSetDto, createdBy: string): Promise<object> {
    // Check slug uniqueness
    const existingSlug = await this.prisma.attributeSet.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException(
        'Attribute set with this slug already exists',
      );
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
        _count: {
          select: {
            attributes: true,
          },
        },
      },
    });

    this.logger.log(
      `Attribute set created: ${attributeSet.slug} by ${createdBy}`,
    );
    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL ATTRIBUTE SETS
  // ══════════════════════════════════════════════════════════════
  async findAll(
    dto: ListAttributeSetsDto,
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
      this.prisma.attributeSet.findMany({
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
              attributes: true,
            },
          },
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
        pageCount: Math.ceil(total / dto.take),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ATTRIBUTE SET BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string): Promise<object> {
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
            values: {
              where: { deletedAt: null },
              select: {
                id: true,
                value: true,
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
      throw new NotFoundException('Attribute set not found');
    }

    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // GET ATTRIBUTE SET BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string): Promise<object> {
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
      throw new NotFoundException('Attribute set not found');
    }

    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE ATTRIBUTE SET
  // ══════════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateAttributeSetDto,
    updatedBy: string,
  ): Promise<object> {
    const existing = await this.prisma.attributeSet.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new NotFoundException('Attribute set not found');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.attributeSet.findFirst({
        where: { slug: dto.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });

      if (slugExists) {
        throw new ConflictException(
          'Attribute set with this slug already exists',
        );
      }
    }

    const attributeSet = await this.prisma.attributeSet.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.translations !== undefined && {
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
      },
      include: {
        attributes: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            position: true,
          },
        },
      },
    });

    this.logger.log(
      `Attribute set updated: ${attributeSet.slug} by ${updatedBy}`,
    );
    return attributeSet;
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE ATTRIBUTE SET
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!attributeSet) {
      throw new NotFoundException('Attribute set not found');
    }

    // Check if any attributes are in use
    const attributeCount = await this.prisma.attribute.count({
      where: { attributeSetId: id, deletedAt: null },
    });

    if (attributeCount > 0) {
      throw new BadRequestException(
        `Cannot delete attribute set. ${attributeCount} attributes are assigned to this set`,
      );
    }

    await this.prisma.softDelete('attributeSet', id, deletedBy);
    this.logger.log(
      `Attribute set deleted: ${attributeSet.slug} by ${deletedBy}`,
    );
  }
}
