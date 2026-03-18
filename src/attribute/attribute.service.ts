// ─── src/attribute/attribute.service.ts ──────────────────────

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, AttributeType } from '@prisma/client';
import {
  CreateAttributeDto,
  UpdateAttributeDto,
  ListAttributesDto,
  AddAttributeValuesDto,
  UpdateAttributeValuesDto,
  ReorderAttributeValuesDto,
} from './dto';

@Injectable()
export class AttributeService {
  private readonly logger = new Logger(AttributeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE ATTRIBUTE
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateAttributeDto, createdBy: string) {
    // Verify attribute set exists
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { id: dto.attributeSetId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!attributeSet) {
      throw new NotFoundException({
        message: 'Attribute set not found',
        resourceId: dto.attributeSetId,
      });
    }

    // Slug must be unique within the same attribute set
    const existingSlug = await this.prisma.attribute.findFirst({
      where: {
        attributeSetId: dto.attributeSetId,
        slug: dto.slug,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException({
        message: `Attribute with slug "${dto.slug}" already exists in attribute set "${attributeSet.name}"`,
        field: 'slug',
        conflictingId: existingSlug.id,
        attributeSetId: dto.attributeSetId,
      });
    }

    const attribute = await this.prisma.attribute.create({
      data: {
        attributeSetId: dto.attributeSetId,
        name: dto.name,
        slug: dto.slug,
        type: dto.type ?? AttributeType.TEXT,
        position: dto.position ?? 0,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdBy,
      },
      select: {
        id: true,
        attributeSetId: true,
        name: true,
        slug: true,
        type: true,
        position: true,
        translations: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { values: true, productAttributes: true } },
      },
    });

    this.logger.log(
      `Attribute created: "${attribute.name}" in set ${dto.attributeSetId} by ${createdBy}`,
    );
    return attribute;
  }

  // ══════════════════════════════════════════════════════════════
  // LIST ATTRIBUTES
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListAttributesDto) {
    const where: Prisma.AttributeWhereInput = {
      deletedAt: null,
      ...(dto.attributeSetId && { attributeSetId: dto.attributeSetId }),
      ...(dto.type && { type: dto.type }),
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { slug: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    const sortMap: Record<string, Prisma.AttributeOrderByWithRelationInput> = {
      name: { name: dto.sortOrder ?? 'asc' },
      slug: { slug: dto.sortOrder ?? 'asc' },
      position: { position: dto.sortOrder ?? 'asc' },
      createdAt: { createdAt: dto.sortOrder ?? 'desc' },
    };
    const orderBy = sortMap[dto.sortBy ?? 'position'] ?? { position: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.attribute.findMany({
        where,
        select: {
          id: true,
          attributeSetId: true,
          name: true,
          slug: true,
          type: true,
          position: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
          attributeSet: { select: { id: true, name: true, slug: true } },
          _count: { select: { values: true, productAttributes: true } },
        },
        orderBy,
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.attribute.count({ where }),
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
  // GET ALL ATTRIBUTES IN A SET (public)
  // ══════════════════════════════════════════════════════════════
  async findByAttributeSet(attributeSetId: string) {
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { id: attributeSetId, deletedAt: null },
      select: { id: true },
    });

    if (!attributeSet) {
      throw new NotFoundException({
        message: 'Attribute set not found',
        resourceId: attributeSetId,
      });
    }

    return this.prisma.attribute.findMany({
      where: { attributeSetId, deletedAt: null },
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
    });
  }

  // ══════════════════════════════════════════════════════════════
  // GET BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      include: {
        attributeSet: { select: { id: true, name: true, slug: true } },
        values: {
          where: { deletedAt: null },
          select: {
            id: true,
            value: true,
            label: true,
            hexColor: true,
            position: true,
            translations: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { productAttributeValues: true } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!attribute) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: id,
      });
    }

    return attribute;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE ATTRIBUTE
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateAttributeDto, updatedBy: string) {
    const existing = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, name: true, attributeSetId: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: id,
      });
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.attribute.findFirst({
        where: {
          attributeSetId: existing.attributeSetId,
          slug: dto.slug,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (slugExists) {
        throw new ConflictException({
          message: 'Slug already used in this attribute set',
          field: 'slug',
          conflictingId: slugExists.id,
        });
      }
    }

    await this.prisma.attribute.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
        updatedBy,
      },
    });

    this.logger.log(`Attribute updated: "${existing.name}" by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // ADD ATTRIBUTE VALUES (batch)
  // ══════════════════════════════════════════════════════════════
  async addValues(id: string, dto: AddAttributeValuesDto, createdBy: string) {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!attribute) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: id,
      });
    }

    // Get existing values to check for duplicates
    const existingValues = await this.prisma.attributeValue.findMany({
      where: { attributeId: id, deletedAt: null },
      select: { value: true, position: true },
      orderBy: { position: 'desc' },
    });

    const existingSet = new Set(
      existingValues.map((v) => v.value.toLowerCase()),
    );
    const maxPos = existingValues[0]?.position ?? -1;

    const duplicates: string[] = [];
    const toCreate: typeof dto.values = [];

    for (const v of dto.values) {
      if (existingSet.has(v.value.toLowerCase())) {
        duplicates.push(v.value);
      } else {
        toCreate.push(v);
        existingSet.add(v.value.toLowerCase());
      }
    }

    let position = maxPos + 1;
    const created = await Promise.all(
      toCreate.map((v) =>
        this.prisma.attributeValue.create({
          data: {
            attributeId: id,
            value: v.value,
            label: v.label ?? null,
            hexColor: v.hexColor ?? null,
            position: position++,
            translations: v.translations
              ? (v.translations as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            createdBy,
          },
          select: {
            id: true,
            value: true,
            label: true,
            hexColor: true,
            position: true,
            translations: true,
          },
        }),
      ),
    );

    this.logger.log(
      `Added ${created.length} values to attribute "${attribute.name}" (${duplicates.length} duplicates skipped)`,
    );

    return {
      added: created,
      skipped: duplicates,
      summary: {
        added: created.length,
        skippedDuplicates: duplicates.length,
        skippedValues: duplicates,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE ATTRIBUTE VALUES (batch)
  // ══════════════════════════════════════════════════════════════
  async updateValues(
    id: string,
    dto: UpdateAttributeValuesDto,
    updatedBy: string,
  ) {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!attribute) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: id,
      });
    }

    const updated = await Promise.all(
      dto.values.map((v) =>
        this.prisma.attributeValue.update({
          where: { id: v.id },
          data: {
            ...(v.value !== undefined && { value: v.value }),
            ...(v.label !== undefined && { label: v.label }),
            ...(v.hexColor !== undefined && { hexColor: v.hexColor }),
            ...(v.position !== undefined && { position: v.position }),
            ...(v.translations !== undefined && {
              translations: v.translations as Prisma.InputJsonValue,
            }),
            updatedBy,
          },
          select: {
            id: true,
            value: true,
            label: true,
            hexColor: true,
            position: true,
            translations: true,
            updatedAt: true,
          },
        }),
      ),
    );

    return updated;
  }

  // ══════════════════════════════════════════════════════════════
  // REORDER ATTRIBUTE VALUES
  // ══════════════════════════════════════════════════════════════
  async reorderValues(id: string, dto: ReorderAttributeValuesDto) {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!attribute) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: id,
      });
    }

    const operations = dto.items.map((item) =>
      this.prisma.attributeValue.update({
        where: { id: item.id },
        data: { position: item.position },
      }),
    );

    await this.prisma.$transaction(operations);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE ATTRIBUTE VALUE
  // ══════════════════════════════════════════════════════════════
  async deleteValue(
    attributeId: string,
    valueId: string,
    deletedBy: string,
  ): Promise<void> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id: attributeId, deletedAt: null },
      select: { id: true },
    });

    if (!attribute) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: attributeId,
      });
    }

    const value = await this.prisma.attributeValue.findFirst({
      where: { id: valueId, attributeId, deletedAt: null },
      select: { id: true, value: true },
    });

    if (!value) {
      throw new NotFoundException({
        message: 'Attribute value not found',
        resourceId: valueId,
      });
    }

    const usageCount = await this.prisma.productAttributeValue.count({
      where: { attributeValueId: valueId },
    });

    if (usageCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete value "${value.value}". It is assigned to ${usageCount} product(s).`,
        usageCount,
        value: value.value,
      });
    }

    await this.prisma.softDelete('attributeValue', valueId, deletedBy);
    this.logger.log(
      `Attribute value deleted: "${value.value}" (${valueId}) by ${deletedBy}`,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE ATTRIBUTE
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });

    if (!attribute) {
      throw new NotFoundException({
        message: 'Attribute not found',
        resourceId: id,
      });
    }

    // Check if attribute is used by any products
    const usageCount = await this.prisma.productAttribute.count({
      where: { attributeId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete attribute "${attribute.name}". It is used by ${usageCount} product(s). Remove it from products first.`,
        usageCount,
      });
    }

    // Soft delete all values first
    await this.prisma.attributeValue.updateMany({
      where: { attributeId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy },
    });

    await this.prisma.softDelete('attribute', id, deletedBy);
    this.logger.log(
      `Attribute deleted: "${attribute.name}" (${attribute.slug}) by ${deletedBy}`,
    );
  }
}
