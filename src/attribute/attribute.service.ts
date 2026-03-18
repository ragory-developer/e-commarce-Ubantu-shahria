// src/attribute/attribute.service.ts

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

  async create(dto: CreateAttributeDto, createdBy: string) {
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
        message: `Attribute with slug "${dto.slug}" already exists in set "${attributeSet.name}"`,
        field: 'slug',
      });
    }

    const attribute = await this.prisma.attribute.create({
      data: {
        attributeSetId: dto.attributeSetId,
        name: dto.name,
        slug: dto.slug,
        type: dto.type ?? AttributeType.TEXT,
        // No position field in Attribute schema
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
        translations: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { values: true, productAttributes: true } },
      },
    });

    this.logger.log(`Attribute created: "${attribute.name}" by ${createdBy}`);
    return attribute;
  }

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

    // Valid sort fields for Attribute (no position)
    const sortMap: Record<string, Prisma.AttributeOrderByWithRelationInput> = {
      name: { name: dto.sortOrder ?? 'asc' },
      slug: { slug: dto.sortOrder ?? 'asc' },
      createdAt: { createdAt: dto.sortOrder ?? 'desc' },
    };
    const orderBy = sortMap[dto.sortBy ?? 'createdAt'] ?? { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.attribute.findMany({
        where,
        select: {
          id: true,
          attributeSetId: true,
          name: true,
          slug: true,
          type: true,
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
        translations: true,
        values: {
          where: { deletedAt: null },
          select: {
            id: true,
            value: true,
            label: true,
            hexColor: true,
            translations: true,
          },
        },
      },
    });
  }

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
            translations: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { productAttributeValues: true } },
          },
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
          message: 'Slug already used in this set',
          field: 'slug',
        });
      }
    }

    await this.prisma.attribute.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.type !== undefined && { type: dto.type }),
        // No position in Attribute schema
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
        updatedBy,
      },
    });

    this.logger.log(`Attribute updated: "${existing.name}" by ${updatedBy}`);
    return this.findOne(id);
  }

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

    // Get existing values to detect duplicates
    const existingValues = await this.prisma.attributeValue.findMany({
      where: { attributeId: id, deletedAt: null },
      select: { value: true },
    });

    const existingSet = new Set(
      existingValues.map((v) => v.value.toLowerCase()),
    );
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

    const created = await Promise.all(
      toCreate.map((v) =>
        this.prisma.attributeValue.create({
          data: {
            attributeId: id,
            value: v.value,
            label: v.label ?? null,
            hexColor: v.hexColor ?? null,
            // No position in AttributeValue schema
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
            translations: true,
          },
        }),
      ),
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
            // No position in schema
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
            translations: true,
            updatedAt: true,
          },
        }),
      ),
    );

    return updated;
  }

  async reorderValues(id: string, dto: ReorderAttributeValuesDto) {
    // AttributeValue has no position field - this is a no-op, just return findOne
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

    // Since AttributeValue has no position field, reorder is not supported
    // Return current state
    this.logger.warn(
      `Reorder attempted on AttributeValue - position field not in schema`,
    );
    return this.findOne(id);
  }

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
        message: `Cannot delete value "${value.value}". Used by ${usageCount} product(s).`,
        usageCount,
      });
    }

    await this.prisma.softDelete('attributeValue', valueId, deletedBy);
  }

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

    const usageCount = await this.prisma.productAttribute.count({
      where: { attributeId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete attribute "${attribute.name}". Used by ${usageCount} product(s).`,
        usageCount,
      });
    }

    await this.prisma.attributeValue.updateMany({
      where: { attributeId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy },
    });

    await this.prisma.softDelete('attribute', id, deletedBy);
  }
}
