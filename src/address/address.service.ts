// ─── src/address/address.service.ts ──────────────────────────

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List customer addresses (non-deleted, default first) ─────
  async list(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ─── Get single address (must belong to customer) ─────────────
  async findOne(id: string, customerId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, customerId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  // ─── Create address ───────────────────────────────────────────
  async create(customerId: string, userId: string, dto: CreateAddressDto) {
    const existingCount = await this.prisma.address.count({
      where: { customerId, deletedAt: null },
    });

    // First address is always default; or if explicitly requested
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
        address: dto.address,
        descriptions: dto.descriptions,
        city: dto.city,
        state: dto.state,
        road: dto.road,
        zip: dto.zip,
        country: dto.country,
        isDefault: shouldBeDefault,
        createdBy: userId,
      },
    });
  }

  // ─── Update address ───────────────────────────────────────────
  async update(
    id: string,
    customerId: string,
    userId: string,
    dto: UpdateAddressDto,
  ) {
    await this.findOne(id, customerId);

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

    return this.prisma.address.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  // ─── Set default ──────────────────────────────────────────────
  async setDefault(id: string, customerId: string, userId: string) {
    await this.findOne(id, customerId);

    await this.prisma.address.updateMany({
      where: { customerId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });

    await this.prisma.address.update({
      where: { id },
      data: { isDefault: true, updatedBy: userId },
    });
  }

  // ─── Soft delete ──────────────────────────────────────────────
  async delete(id: string, customerId: string, userId: string) {
    const existing = await this.findOne(id, customerId);

    await this.prisma.softDelete('address', id, userId);

    // If deleted address was default, promote the next most recent
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

  // ─── Internal: save address from order (guest checkout) ───────
  // Called by OrderService after an order is placed.
  // Prevents duplicates and auto-sets first address as default.
  async saveFromOrder(
    customerId: string,
    shippingAddress: {
      address: string;
      city: string;
      state: string;
      road?: string;
      zip: string;
      country: string;
    },
  ): Promise<void> {
    // Don't duplicate if same address exists
    const existing = await this.prisma.address.findFirst({
      where: {
        customerId,
        address: shippingAddress.address,
        city: shippingAddress.city,
        zip: shippingAddress.zip,
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
        address: shippingAddress.address,
        descriptions: '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        road: shippingAddress.road ?? '',
        zip: shippingAddress.zip,
        country: shippingAddress.country,
        isDefault: hasAny === 0,
      },
    });
  }
}
