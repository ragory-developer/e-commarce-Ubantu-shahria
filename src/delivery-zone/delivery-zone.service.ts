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
  CreateDeliveryZoneDto,
  UpdateDeliveryZoneDto,
  ListDeliveryZonesDto,
} from './dto';

@Injectable()
export class DeliveryZoneService {
  private readonly logger = new Logger(DeliveryZoneService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeliveryZoneDto, createdBy: string) {
    const existing = await this.prisma.deliveryZone.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }], deletedAt: null },
      select: { id: true, name: true },
    });
    if (existing)
      throw new ConflictException('Delivery zone name or slug already exists');

    const zone = await this.prisma.deliveryZone.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        isActive: dto.isActive ?? true,
      },
    });

    // Assign areas if provided
    if (dto.areaIds?.length) {
      await this.prisma.area.updateMany({
        where: { id: { in: dto.areaIds } },
        data: { deliveryZoneId: zone.id },
      });
    }

    this.logger.log(`Delivery zone created: ${zone.name} by ${createdBy}`);
    return this.findOne(zone.id);
  }

  async findAll(dto: ListDeliveryZonesDto) {
    const where: Prisma.DeliveryZoneWhereInput = {
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
      this.prisma.deliveryZone.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { areas: true, shippingRules: true } },
        },
        orderBy: { name: 'asc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.deliveryZone.count({ where }),
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

  async findOne(id: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, deletedAt: null },
      include: {
        areas: {
          select: {
            id: true,
            name: true,
            slug: true,
            postalCode: true,
            city: {
              select: {
                id: true,
                name: true,
                division: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        shippingRules: {
          where: { deletedAt: null, isActive: true },
          include: {
            courier: {
              select: { id: true, name: true, slug: true, logo: true },
            },
          },
        },
        _count: { select: { areas: true, orders: true } },
      },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');
    return zone;
  }

  async findBySlug(slug: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { slug, deletedAt: null },
      include: {
        shippingRules: {
          where: { deletedAt: null, isActive: true },
          include: {
            courier: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { baseCost: 'asc' },
        },
      },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');
    return zone;
  }

  async update(id: string, dto: UpdateDeliveryZoneDto, updatedBy: string) {
    const existing = await this.prisma.deliveryZone.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!existing) throw new NotFoundException('Delivery zone not found');

    if (
      (dto.name && dto.name !== existing.name) ||
      (dto.slug && dto.slug !== existing.slug)
    ) {
      const dup = await this.prisma.deliveryZone.findFirst({
        where: {
          deletedAt: null,
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.slug ? [{ slug: dto.slug }] : []),
          ],
        },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Name or slug already in use');
    }

    await this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Delivery zone updated: ${id} by ${updatedBy}`);
    return this.findOne(id);
  }

  async assignAreas(id: string, areaIds: string[], updatedBy: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');

    // Unassign existing areas from this zone first
    await this.prisma.area.updateMany({
      where: { deliveryZoneId: id },
      data: { deliveryZoneId: null },
    });

    // Assign new areas
    if (areaIds.length) {
      await this.prisma.area.updateMany({
        where: { id: { in: areaIds } },
        data: { deliveryZoneId: id },
      });
    }

    this.logger.log(`Delivery zone ${id} areas updated by ${updatedBy}`);
    return this.findOne(id);
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');

    // Unassign areas
    await this.prisma.area.updateMany({
      where: { deliveryZoneId: id },
      data: { deliveryZoneId: null },
    });

    await this.prisma.softDelete('deliveryZone', id, deletedBy);
    this.logger.log(`Delivery zone deleted: ${zone.name} by ${deletedBy}`);
  }
}
