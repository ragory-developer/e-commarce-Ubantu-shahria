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
} from './dto';

@Injectable()
export class AttributeService {
  private readonly logger = new Logger(AttributeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAttributeDto, createdBy: string): Promise<object> {
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { id: dto.attributeSetId, deletedAt: null },
      select: { id: true },
    });

    if (!attributeSet) {
      throw new NotFoundException('Attribute set not found');
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
      throw new ConflictException(
        'Attribute with this slug already exists in this set',
      );
    }

    const attribute = await this.prisma.attribute.create({
      data: {
        attributeSetId: dto.attributeSetId,
        name: dto.name,
        slug: dto.slug,
        type: dto.type || AttributeType.TEXT,
        position: dto.position || 0,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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
        _count: {
          select: {
            values: true,
            productAttributes: true,
          },
        },
      },
    });

    this.logger.log(`Attribute created: ${attribute.slug} by ${createdBy}`);
    return attribute;
  }

  async findAll(
    dto: ListAttributesDto,
  ): Promise<{ data: object[]; total: number; meta: object }> {
    const where = {
      deletedAt: null,
      ...(dto.attributeSetId && { attributeSetId: dto.attributeSetId }),
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' as const } },
          { slug: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),
    };

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
          _count: {
            select: {
              values: true,
              productAttributes: true,
            },
          },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
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
        pageCount: Math.ceil(total / dto.take),
      },
    };
  }

  async findByAttributeSet(attributeSetId: string): Promise<object[]> {
    const attributeSet = await this.prisma.attributeSet.findFirst({
      where: { id: attributeSetId, deletedAt: null },
      select: { id: true },
    });

    if (!attributeSet) {
      throw new NotFoundException('Attribute set not found');
    }

    return this.prisma.attribute.findMany({
      where: {
        attributeSetId,
        deletedAt: null,
      },
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
    });
  }

  async findOne(id: string): Promise<object> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      include: {
        attributeSet: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        values: {
          where: { deletedAt: null },
          select: {
            id: true,
            value: true,
            position: true,
            translations: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    return attribute;
  }

  async update(
    id: string,
    dto: UpdateAttributeDto,
    updatedBy: string,
  ): Promise<object> {
    const existing = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, attributeSetId: true },
    });

    if (!existing) {
      throw new NotFoundException('Attribute not found');
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
        throw new ConflictException(
          'Attribute with this slug already exists in this set',
        );
      }
    }

    const attribute = await this.prisma.attribute.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.type !== undefined && { type: dto.type as AttributeType }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.translations !== undefined && {
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
        updatedBy,
      },
      include: {
        values: {
          where: { deletedAt: null },
          select: {
            id: true,
            value: true,
            position: true,
          },
        },
      },
    });

    this.logger.log(`Attribute updated: ${attribute.slug} by ${updatedBy}`);
    return attribute;
  }

  async addValues(
    id: string,
    dto: AddAttributeValuesDto,
    createdBy: string,
  ): Promise<object[]> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    const maxPosition = await this.prisma.attributeValue.findFirst({
      where: { attributeId: id, deletedAt: null },
      select: { position: true },
      orderBy: { position: 'desc' },
    });

    let position = (maxPosition?.position ?? -1) + 1;

    const values = await Promise.all(
      dto.values.map((value) =>
        this.prisma.attributeValue.create({
          data: {
            attributeId: id,
            value: value.value,
            position: position++,
            translations: value.translations
              ? (value.translations as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            createdBy,
          },
          select: {
            id: true,
            value: true,
            position: true,
            translations: true,
            createdAt: true,
          },
        }),
      ),
    );

    this.logger.log(`Added ${values.length} values to attribute ${id}`);
    return values;
  }

  async updateValues(
    id: string,
    dto: UpdateAttributeValuesDto,
    updatedBy: string,
  ): Promise<object[]> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    const updated = await Promise.all(
      dto.values.map((value) =>
        this.prisma.attributeValue.update({
          where: { id: value.id },
          data: {
            value: value.value,
            position: value.position,
            ...(value.translations && {
              translations: value.translations as Prisma.InputJsonValue,
            }),
            updatedBy,
          },
          select: {
            id: true,
            value: true,
            position: true,
            translations: true,
            updatedAt: true,
          },
        }),
      ),
    );

    this.logger.log(`Updated ${updated.length} values for attribute ${id}`);
    return updated;
  }

  async deleteValue(
    id: string,
    valueId: string,
    deletedBy: string,
  ): Promise<void> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    const value = await this.prisma.attributeValue.findFirst({
      where: { id: valueId, attributeId: id, deletedAt: null },
      select: { id: true, value: true },
    });

    if (!value) {
      throw new NotFoundException('Attribute value not found');
    }

    const usage = await this.prisma.productAttributeValue.count({
      where: { attributeValueId: valueId },
    });

    if (usage > 0) {
      throw new BadRequestException(
        `Cannot delete value "${value.value}". It is used by ${usage} products.`,
      );
    }

    await this.prisma.softDelete('attributeValue', valueId, deletedBy);
    this.logger.log(`Attribute value deleted: ${value.value}`);
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    const attribute = await this.prisma.attribute.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    const usage = await this.prisma.productAttribute.count({
      where: { attributeId: id },
    });

    if (usage > 0) {
      throw new BadRequestException(
        `Cannot delete attribute. It is used by ${usage} products.`,
      );
    }

    await this.prisma.attributeValue.updateMany({
      where: { attributeId: id, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });

    await this.prisma.softDelete('attribute', id, deletedBy);
    this.logger.log(`Attribute deleted: ${attribute.slug}`);
  }
}
