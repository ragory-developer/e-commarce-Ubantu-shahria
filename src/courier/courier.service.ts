// src/courier/courier.service.ts — extracted from courier.module.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ─── DTOs ────────────────────────────────────────────────────

export class CreateCourierDto {
  @ApiProperty({ example: 'Pathao' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'pathao' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) =>
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
  )
  slug!: string;

  @ApiPropertyOptional({ example: '+8801700000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://pathao.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Media ID for courier logo' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Tracking URL template. Use {trackingNumber} placeholder.',
    example: 'https://pathao.com/track/{trackingNumber}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrlTemplate?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateCourierDto extends PartialType(CreateCourierDto) {}

export class ListCouriersDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

// ─── SERVICE ─────────────────────────────────────────────────

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourierDto, createdBy: string) {
    const existing = await this.prisma.courier.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }], deletedAt: null },
    });
    if (existing)
      throw new ConflictException('Courier name or slug already exists');

    const courier = await this.prisma.courier.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        phone: dto.phone ?? null,
        website: dto.website ?? null,
        logo: dto.logo ?? null,
        trackingUrlTemplate: dto.trackingUrlTemplate ?? null,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      },
    });
    this.logger.log(`Courier created: ${courier.name} by ${createdBy}`);
    return courier;
  }

  async findAll(dto: ListCouriersDto) {
    const where: Prisma.CourierWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { slug: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.courier.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          website: true,
          logo: true,
          trackingUrlTemplate: true,
          isActive: true,
          position: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { shippingRules: true, orderPackages: true } },
        },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.courier.count({ where }),
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

  async findOne(id: string) {
    const courier = await this.prisma.courier.findFirst({
      where: { id, deletedAt: null },
      include: {
        shippingRules: {
          where: { deletedAt: null, isActive: true },
          include: {
            deliveryZone: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { orderPackages: true } },
      },
    });
    if (!courier) throw new NotFoundException('Courier not found');
    return courier;
  }

  async findBySlug(slug: string) {
    const courier = await this.prisma.courier.findFirst({
      where: { slug, deletedAt: null, isActive: true },
    });
    if (!courier) throw new NotFoundException('Courier not found');
    return courier;
  }

  async update(id: string, dto: UpdateCourierDto, updatedBy: string) {
    await this.findOne(id);

    if (dto.name || dto.slug) {
      const dup = await this.prisma.courier.findFirst({
        where: {
          deletedAt: null,
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.slug ? [{ slug: dto.slug }] : []),
          ],
        },
      });
      if (dup)
        throw new ConflictException('Courier name or slug already in use');
    }

    return this.prisma.courier.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        ...(dto.trackingUrlTemplate !== undefined && {
          trackingUrlTemplate: dto.trackingUrlTemplate,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.softDelete('courier', id, deletedBy);
  }

  async toggleActive(id: string) {
    const courier = await this.findOne(id);
    return this.prisma.courier.update({
      where: { id },
      data: { isActive: !courier.isActive },
      select: { id: true, name: true, isActive: true },
    });
  }
}
