// src/address/address.service.ts
// Production-ready address service with hierarchical location support

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────
  // LIST
  // ──────────────────────────────────────────────────────────────
  async list(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId, deletedAt: null },
      include: {
        division: { select: { id: true, name: true, slug: true } },
        city: { select: { id: true, name: true, slug: true } },
        area: {
          select: {
            id: true,
            name: true,
            slug: true,
            postalCode: true,
            deliveryZone: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ──────────────────────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────────────────────
  async findOne(id: string, customerId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, customerId, deletedAt: null },
      include: {
        division: { select: { id: true, name: true, slug: true } },
        city: { select: { id: true, name: true, slug: true } },
        area: {
          select: {
            id: true,
            name: true,
            slug: true,
            postalCode: true,
            deliveryZone: {
              select: { id: true, name: true, slug: true, isActive: true },
            },
          },
        },
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  // ──────────────────────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────────────────────
  async create(customerId: string, _userId: string, dto: CreateAddressDto) {
    await this.validateLocationHierarchy(
      dto.divisionId,
      dto.cityId,
      dto.areaId,
    );

    const existingCount = await this.prisma.address.count({
      where: { customerId, deletedAt: null },
    });

    const shouldBeDefault = dto.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await this.prisma.address.updateMany({
        where: { customerId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        customerId,
        label: dto.label ?? null,
        fullName: dto.fullName,
        phone: dto.phone,
        addressLine: dto.addressLine,
        divisionId: dto.divisionId,
        cityId: dto.cityId,
        areaId: dto.areaId,
        postalCode: dto.postalCode,
        country: dto.country ?? 'BD',
        isDefault: shouldBeDefault,
      },
      include: {
        division: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        area: { select: { id: true, name: true, postalCode: true } },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────
  async update(
    id: string,
    customerId: string,
    _userId: string,
    dto: UpdateAddressDto,
  ) {
    await this.findOne(id, customerId);

    if (dto.divisionId || dto.cityId || dto.areaId) {
      const current = await this.prisma.address.findUnique({
        where: { id },
        select: { divisionId: true, cityId: true, areaId: true },
      });

      const divisionId = dto.divisionId ?? current!.divisionId!;
      const cityId = dto.cityId ?? current!.cityId!;
      const areaId = dto.areaId ?? current!.areaId!;

      await this.validateLocationHierarchy(divisionId, cityId, areaId);
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          customerId,
          isDefault: true,
          id: { not: id },
          deletedAt: null,
        },
        data: { isDefault: false },
      });
    }

    // Remove updatedBy - not in Address schema
    const { ...updateData } = dto;

    return this.prisma.address.update({
      where: { id },
      data: updateData,
      include: {
        division: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        area: { select: { id: true, name: true, postalCode: true } },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // SET DEFAULT
  // ──────────────────────────────────────────────────────────────
  async setDefault(id: string, customerId: string, _userId: string) {
    await this.findOne(id, customerId);

    await this.prisma.address.updateMany({
      where: { customerId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });

    await this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────────────────────
  async delete(id: string, customerId: string, userId: string) {
    const existing = await this.findOne(id, customerId);

    await this.prisma.softDelete('address', id, userId);

    if (existing.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { customerId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // GET DEFAULT
  // ──────────────────────────────────────────────────────────────
  async getDefaultAddress(customerId: string) {
    return this.prisma.address.findFirst({
      where: { customerId, isDefault: true, deletedAt: null },
      include: {
        division: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        area: {
          select: {
            id: true,
            name: true,
            postalCode: true,
            deliveryZone: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // SAVE FROM ORDER (guest checkout)
  // ──────────────────────────────────────────────────────────────
  async saveFromOrder(
    customerId: string,
    shippingAddress: {
      fullName: string;
      phone: string;
      addressLine: string;
      divisionId?: string;
      cityId?: string;
      areaId?: string;
      postalCode: string;
      country?: string;
    },
  ): Promise<void> {
    const existing = await this.prisma.address.findFirst({
      where: {
        customerId,
        addressLine: shippingAddress.addressLine,
        postalCode: shippingAddress.postalCode,
        deletedAt: null,
      },
    });
    if (existing) return;

    const hasAny = await this.prisma.address.count({
      where: { customerId, deletedAt: null },
    });

    await this.prisma.address.create({
      data: {
        customerId,
        label: 'Order Address',
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        addressLine: shippingAddress.addressLine,
        divisionId: shippingAddress.divisionId,
        cityId: shippingAddress.cityId,
        areaId: shippingAddress.areaId,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country ?? 'BD',
        isDefault: hasAny === 0,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PRIVATE: validate location hierarchy
  // ──────────────────────────────────────────────────────────────
  private async validateLocationHierarchy(
    divisionId: string,
    cityId: string,
    areaId: string,
  ): Promise<void> {
    const division = await this.prisma.division.findFirst({
      where: { id: divisionId, isActive: true, deletedAt: null },
    });
    if (!division) {
      throw new BadRequestException('Invalid division selected');
    }

    const city = await this.prisma.city.findFirst({
      where: { id: cityId, divisionId, isActive: true },
    });
    if (!city) {
      throw new BadRequestException(
        'Invalid city or city does not belong to the selected division',
      );
    }

    const area = await this.prisma.area.findFirst({
      where: { id: areaId, cityId, isActive: true },
    });
    if (!area) {
      throw new BadRequestException(
        'Invalid area or area does not belong to the selected city',
      );
    }
  }
}
