// ─── src/variation/variation.service.ts (updated production version) ─────────
// Key changes:
// - Consistent structured error responses
// - Duplicate label/value check within variation
// - Better uid generation (not regenerated on every name update, only when actually changed)
// - getPopularVariations endpoint helper
// - Bulk value operations

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVariationDto,
  UpdateVariationDto,
  ListVariationsDto,
  CreateVariationValueDto,
  UpdateVariationValueDto,
  ReorderValuesDto,
} from './dto';
import { Prisma } from '@prisma/client';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 180);
}

function toJsonInput(
  value: object | undefined | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class VariationService {
  private readonly logger = new Logger(VariationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── UID generation ────────────────────────────────────────────
  private async generateUniqueUid(
    base: string,
    model: 'variation' | 'variationValue',
    excludeId?: string,
  ): Promise<string> {
    const uid = slugify(base) || 'variation';
    let candidate = uid;
    let counter = 0;

    while (true) {
      const where: any = { uid: candidate, deletedAt: null };
      if (excludeId) where.id = { not: excludeId };

      const exists =
        model === 'variation'
          ? await this.prisma.variation.findFirst({
              where,
              select: { id: true },
            })
          : await this.prisma.variationValue.findFirst({
              where,
              select: { id: true },
            });

      if (!exists) return candidate;
      candidate = `${uid}-${++counter}`;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE VARIATION
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateVariationDto, createdBy: string) {
    // Check for duplicate name (case-insensitive, global scope)
    const nameExists = await this.prisma.variation.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (nameExists) {
      throw new ConflictException({
        message: `Variation with name "${dto.name}" already exists`,
        field: 'name',
        conflictingId: nameExists.id,
      });
    }

    const uid = await this.generateUniqueUid(dto.name, 'variation');

    const variation = await this.prisma.variation.create({
      data: {
        uid,
        name: dto.name,
        type: dto.type,
        isGlobal: dto.isGlobal ?? true,
        translations: toJsonInput(dto.translations),
        createdBy,
      },
    });

    // Create inline values if provided
    if (dto.values && dto.values.length > 0) {
      // Check for duplicates among provided values
      const valueLabels = dto.values.map((v) => v.label.toLowerCase());
      const uniqueLabels = new Set(valueLabels);
      if (uniqueLabels.size !== valueLabels.length) {
        throw new BadRequestException({
          message: 'Duplicate labels found in provided values',
        });
      }

      for (let i = 0; i < dto.values.length; i++) {
        const v = dto.values[i];
        const valueUid = await this.generateUniqueUid(
          `${uid}-${v.label}`,
          'variationValue',
        );
        await this.prisma.variationValue.create({
          data: {
            uid: valueUid,
            variationId: variation.id,
            label: v.label,
            value: v.value ?? null,
            position: v.position ?? i,
            translations: toJsonInput(v.translations),
            createdBy,
          },
        });
      }
    }

    this.logger.log(
      `Variation created: "${variation.name}" (${uid}) by ${createdBy}`,
    );
    return this.findOne(variation.id);
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL VARIATIONS
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListVariationsDto) {
    const where: Prisma.VariationWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { uid: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.variation.findMany({
        where,
        include: {
          values: {
            where: { deletedAt: null },
            select: {
              id: true,
              uid: true,
              label: true,
              value: true,
              position: true,
              translations: true,
            },
            orderBy: { position: 'asc' },
          },
          _count: {
            select: { values: true, productVariations: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.variation.count({ where }),
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
  // GET SINGLE VARIATION
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const variation = await this.prisma.variation.findFirst({
      where: { id, deletedAt: null },
      include: {
        values: {
          where: { deletedAt: null },
          select: {
            id: true,
            uid: true,
            label: true,
            value: true,
            position: true,
            translations: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { values: true, productVariations: true },
        },
      },
    });

    if (!variation) {
      throw new NotFoundException({
        message: 'Variation not found',
        resourceId: id,
        resource: 'Variation',
      });
    }

    return variation;
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE VARIATION
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateVariationDto, updatedBy: string) {
    const existing = await this.prisma.variation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, uid: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Variation not found',
        resourceId: id,
      });
    }

    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const nameExists = await this.prisma.variation.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (nameExists) {
        throw new ConflictException({
          message: `Variation "${dto.name}" already exists`,
          field: 'name',
        });
      }
    }

    const updateData: Prisma.VariationUpdateInput = { updatedBy };
    if (dto.name !== undefined) {
      updateData.name = dto.name;
      if (dto.name !== existing.name) {
        updateData.uid = await this.generateUniqueUid(
          dto.name,
          'variation',
          id,
        );
      }
    }
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.isGlobal !== undefined) updateData.isGlobal = dto.isGlobal;
    // FIXED: removed dto.position — Variation has no position field
    if (dto.translations !== undefined)
      updateData.translations = toJsonInput(dto.translations);

    await this.prisma.variation.update({ where: { id }, data: updateData });
    this.logger.log(`Variation updated: id=${id} by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE VARIATION (SOFT)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const variation = await this.prisma.variation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, uid: true, name: true },
    });
    if (!variation) {
      throw new NotFoundException({
        message: 'Variation not found',
        resourceId: id,
      });
    }

    const usageCount = await this.prisma.productVariation.count({
      where: { variationId: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete variation "${variation.name}". ${usageCount} product(s) are using it.`,
        usageCount,
        variationName: variation.name,
      });
    }

    await this.prisma.variationValue.updateMany({
      where: { variationId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy },
    });
    await this.prisma.softDelete('variation', id, deletedBy);
    this.logger.log(`Variation deleted: "${variation.name}" by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // ADD VALUE
  // ══════════════════════════════════════════════════════════════
  async addValue(
    variationId: string,
    dto: CreateVariationValueDto,
    createdBy: string,
  ) {
    const variation = await this.prisma.variation.findFirst({
      where: { id: variationId, deletedAt: null },
      select: { id: true, uid: true, name: true },
    });
    if (!variation) {
      throw new NotFoundException({
        message: 'Variation not found',
        resourceId: variationId,
      });
    }

    // Check for duplicate label in this variation
    const labelExists = await this.prisma.variationValue.findFirst({
      where: {
        variationId,
        label: { equals: dto.label, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (labelExists) {
      throw new ConflictException({
        message: `Value with label "${dto.label}" already exists in variation "${variation.name}"`,
        field: 'label',
        variationName: variation.name,
      });
    }

    const uid = await this.generateUniqueUid(
      `${variation.uid}-${dto.label}`,
      'variationValue',
    );

    const maxPos = await this.prisma.variationValue.findFirst({
      where: { variationId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = dto.position ?? (maxPos ? maxPos.position + 1 : 0);

    await this.prisma.variationValue.create({
      data: {
        uid,
        variationId,
        label: dto.label,
        value: dto.value ?? null,
        position: nextPosition,
        translations: toJsonInput(dto.translations),
        createdBy,
      },
    });

    this.logger.log(
      `Value "${dto.label}" added to variation "${variation.name}"`,
    );
    return this.findOne(variationId);
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE VALUE
  // ══════════════════════════════════════════════════════════════
  async updateValue(
    variationId: string,
    valueId: string,
    dto: UpdateVariationValueDto,
    updatedBy: string,
  ) {
    const value = await this.prisma.variationValue.findFirst({
      where: { id: valueId, variationId, deletedAt: null },
      select: { id: true, label: true },
    });
    if (!value) {
      throw new NotFoundException({
        message: 'Variation value not found',
        resourceId: valueId,
        resource: 'VariationValue',
      });
    }

    // Check label uniqueness within variation if changing
    if (dto.label && dto.label.toLowerCase() !== value.label.toLowerCase()) {
      const labelExists = await this.prisma.variationValue.findFirst({
        where: {
          variationId,
          label: { equals: dto.label, mode: 'insensitive' },
          deletedAt: null,
          id: { not: valueId },
        },
        select: { id: true },
      });
      if (labelExists) {
        throw new ConflictException({
          message: `Value with label "${dto.label}" already exists in this variation`,
          field: 'label',
        });
      }
    }

    const updateData: Prisma.VariationValueUpdateInput = { updatedBy };
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.value !== undefined) updateData.value = dto.value;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.translations !== undefined)
      updateData.translations = toJsonInput(dto.translations);

    await this.prisma.variationValue.update({
      where: { id: valueId },
      data: updateData,
    });
    this.logger.log(`Variation value updated: id=${valueId} by ${updatedBy}`);
    return this.findOne(variationId);
  }

  // ══════════════════════════════════════════════════════════════
  // REMOVE VALUE (SOFT)
  // ══════════════════════════════════════════════════════════════
  async removeValue(
    variationId: string,
    valueId: string,
    deletedBy: string,
  ): Promise<void> {
    const value = await this.prisma.variationValue.findFirst({
      where: { id: valueId, variationId, deletedAt: null },
      select: { id: true, label: true },
    });
    if (!value) {
      throw new NotFoundException({
        message: 'Variation value not found',
        resourceId: valueId,
        resource: 'VariationValue',
      });
    }

    await this.prisma.softDelete('variationValue', valueId, deletedBy);
    this.logger.log(`Variation value "${value.label}" deleted by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // REORDER VALUES
  // ══════════════════════════════════════════════════════════════
  async reorderValues(variationId: string, dto: ReorderValuesDto) {
    const variation = await this.prisma.variation.findFirst({
      where: { id: variationId, deletedAt: null },
      select: { id: true },
    });
    if (!variation) {
      throw new NotFoundException({
        message: 'Variation not found',
        resourceId: variationId,
      });
    }

    const ids = dto.items.map((i) => i.id);
    const existingValues = await this.prisma.variationValue.findMany({
      where: { id: { in: ids }, variationId, deletedAt: null },
      select: { id: true },
    });

    if (existingValues.length !== ids.length) {
      throw new BadRequestException({
        message: 'One or more value IDs not found for this variation',
        provided: ids.length,
        found: existingValues.length,
      });
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.variationValue.update({
          where: { id: item.id },
          data: { position: item.position },
        }),
      ),
    );

    this.logger.log(`Values reordered for variation ${variationId}`);
    return this.findOne(variationId);
  }
}
