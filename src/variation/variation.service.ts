// ─── src/variation/variation.service.ts ───────────────────────

import {
  Injectable,
  NotFoundException,
  BadRequestException,
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

// ─── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 180);
}

/** Safely convert DTO translations (object | undefined) to Prisma-compatible JSON */
function toJsonInput(
  value: object | undefined | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class VariationService {
  private readonly logger = new Logger(VariationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Generate unique uid ────────────────────────────────────
  private async generateUniqueUid(
    base: string,
    model: 'variation' | 'variationValue',
  ): Promise<string> {
    let uid = slugify(base);
    if (!uid) uid = 'variation';

    let candidate = uid;
    let counter = 0;

    while (true) {
      let exists: { id: string } | null = null;

      if (model === 'variation') {
        exists = await this.prisma.variation.findFirst({
          where: { uid: candidate, deletedAt: null },
          select: { id: true },
        });
      } else {
        exists = await this.prisma.variationValue.findFirst({
          where: { uid: candidate, deletedAt: null },
          select: { id: true },
        });
      }

      if (!exists) return candidate;
      counter++;
      candidate = `${uid}-${counter}`;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE VARIATION
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateVariationDto, createdBy: string) {
    const uid = await this.generateUniqueUid(dto.name, 'variation');

    const variation = await this.prisma.variation.create({
      data: {
        uid,
        name: dto.name,
        type: dto.type,
        isGlobal: dto.isGlobal ?? true,
        position: dto.position ?? 0,
        translations: toJsonInput(dto.translations),
        createdBy,
      },
    });

    // Create inline values if provided
    if (dto.values && dto.values.length > 0) {
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

    this.logger.log(`Variation created: ${uid} by ${createdBy}`);
    return this.findOne(variation.id);
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL VARIATIONS
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListVariationsDto) {
    const where: Prisma.VariationWhereInput = {
      deletedAt: null,
      ...(dto.search
        ? { name: { contains: dto.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.variation.findMany({
        where,
        include: {
          values: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
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
      },
    };
  }

  // ═══════���══════════════════════════════════════════════════════
  // GET SINGLE VARIATION
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const variation = await this.prisma.variation.findFirst({
      where: { id, deletedAt: null },
      include: {
        values: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!variation) {
      throw new NotFoundException('Variation not found');
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
      throw new NotFoundException('Variation not found');
    }

    // Build update data object explicitly to avoid conditional spread type issues
    const updateData: Prisma.VariationUpdateInput = { updatedBy };

    if (dto.name !== undefined) {
      updateData.name = dto.name;

      // Regenerate uid if name changed
      if (dto.name !== existing.name) {
        updateData.uid = await this.generateUniqueUid(dto.name, 'variation');
      }
    }

    if (dto.type !== undefined) {
      updateData.type = dto.type;
    }

    if (dto.isGlobal !== undefined) {
      updateData.isGlobal = dto.isGlobal;
    }

    if (dto.position !== undefined) {
      updateData.position = dto.position;
    }

    if (dto.translations !== undefined) {
      updateData.translations = toJsonInput(dto.translations);
    }

    await this.prisma.variation.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Variation updated: ${id} by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE VARIATION (SOFT)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const variation = await this.prisma.variation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, uid: true },
    });

    if (!variation) {
      throw new NotFoundException('Variation not found');
    }

    const usageCount = await this.prisma.productVariation.count({
      where: { variationId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete variation. ${usageCount} products are using it`,
      );
    }

    // Soft delete all values first
    await this.prisma.variationValue.updateMany({
      where: { variationId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy },
    });

    // Soft delete the variation itself
    await this.prisma.softDelete('variation', id, deletedBy);
    this.logger.log(`Variation deleted: ${variation.uid} by ${deletedBy}`);
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
      select: { id: true, uid: true },
    });

    if (!variation) {
      throw new NotFoundException('Variation not found');
    }

    const uid = await this.generateUniqueUid(
      `${variation.uid}-${dto.label}`,
      'variationValue',
    );

    // Get the max position for ordering
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

    this.logger.log(`Value added to variation ${variationId}: ${uid}`);
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
      select: { id: true },
    });

    if (!value) {
      throw new NotFoundException('Variation value not found');
    }

    // Build update data explicitly to avoid conditional spread type issues
    const updateData: Prisma.VariationValueUpdateInput = { updatedBy };

    if (dto.label !== undefined) {
      updateData.label = dto.label;
    }

    if (dto.value !== undefined) {
      updateData.value = dto.value;
    }

    if (dto.position !== undefined) {
      updateData.position = dto.position;
    }

    if (dto.translations !== undefined) {
      updateData.translations = toJsonInput(dto.translations);
    }

    await this.prisma.variationValue.update({
      where: { id: valueId },
      data: updateData,
    });

    this.logger.log(`Value updated: ${valueId} by ${updatedBy}`);
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
      select: { id: true },
    });

    if (!value) {
      throw new NotFoundException('Variation value not found');
    }

    await this.prisma.softDelete('variationValue', valueId, deletedBy);
    this.logger.log(`Value deleted: ${valueId} by ${deletedBy}`);
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
      throw new NotFoundException('Variation not found');
    }

    // Build the array of update operations with explicit typing
    const operations: Prisma.PrismaPromise<unknown>[] = dto.items.map((item) =>
      this.prisma.variationValue.update({
        where: { id: item.id },
        data: { position: item.position },
      }),
    );

    await this.prisma.$transaction(operations);

    this.logger.log(`Values reordered for variation ${variationId}`);
    return this.findOne(variationId);
  }
}
