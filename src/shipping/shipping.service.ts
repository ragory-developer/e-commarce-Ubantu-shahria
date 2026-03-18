import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ShippingRuleType } from '@prisma/client';
import {
  CreateShippingRuleDto,
  UpdateShippingRuleDto,
  ListShippingRulesDto,
} from './dto';

export interface ShippingCalculationInput {
  deliveryZoneId: string;
  courierId?: string;
  cartTotal: number;
  totalWeight?: number;
  itemCount?: number;
}

export interface ShippingOption {
  courierId: string;
  courierName: string;
  courierLogo: string | null;
  ruleId: string;
  baseCost: number;
  totalCost: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  isFree: boolean;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShippingRuleDto, createdBy: string) {
    // Check zone + courier combination is unique
    const dup = await this.prisma.shippingRule.findFirst({
      where: {
        deliveryZoneId: dto.deliveryZoneId,
        courierId: dto.courierId,
        deletedAt: null,
      },
    });
    if (dup)
      throw new ConflictException(
        'A shipping rule already exists for this zone + courier combination',
      );

    const [zone, courier] = await Promise.all([
      this.prisma.deliveryZone.findFirst({
        where: { id: dto.deliveryZoneId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.courier.findFirst({
        where: { id: dto.courierId, deletedAt: null },
        select: { id: true },
      }),
    ]);

    if (!zone) throw new NotFoundException('Delivery zone not found');
    if (!courier) throw new NotFoundException('Courier not found');

    const rule = await this.prisma.shippingRule.create({
      data: {
        deliveryZoneId: dto.deliveryZoneId,
        courierId: dto.courierId,
        rateType: dto.rateType ?? ShippingRuleType.FLAT,
        baseCost: new Prisma.Decimal(dto.baseCost),
        perKgCost: new Prisma.Decimal(dto.perKgCost ?? 0),
        freeShippingMinimum:
          dto.freeShippingMinimum != null
            ? new Prisma.Decimal(dto.freeShippingMinimum)
            : null,
        estimatedMinDays: dto.estimatedMinDays ?? 1,
        estimatedMaxDays: dto.estimatedMaxDays ?? 3,
        isActive: dto.isActive ?? true,
      },
      include: {
        deliveryZone: { select: { id: true, name: true, slug: true } },
        courier: { select: { id: true, name: true, slug: true, logo: true } },
      },
    });

    this.logger.log(
      `Shipping rule created for zone ${dto.deliveryZoneId} by ${createdBy}`,
    );
    return rule;
  }

  async findAll(dto: ListShippingRulesDto) {
    const where: Prisma.ShippingRuleWhereInput = {
      deletedAt: null,
      ...(dto.deliveryZoneId && { deliveryZoneId: dto.deliveryZoneId }),
      ...(dto.courierId && { courierId: dto.courierId }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.shippingRule.findMany({
        where,
        include: {
          deliveryZone: { select: { id: true, name: true, slug: true } },
          courier: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ deliveryZone: { name: 'asc' } }, { baseCost: 'asc' }],
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.shippingRule.count({ where }),
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
    const rule = await this.prisma.shippingRule.findFirst({
      where: { id, deletedAt: null },
      include: {
        deliveryZone: { select: { id: true, name: true, slug: true } },
        courier: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            trackingUrlTemplate: true,
          },
        },
      },
    });
    if (!rule) throw new NotFoundException('Shipping rule not found');
    return rule;
  }

  async update(id: string, dto: UpdateShippingRuleDto, updatedBy: string) {
    await this.findOne(id);

    const rule = await this.prisma.shippingRule.update({
      where: { id },
      data: {
        ...(dto.rateType && { rateType: dto.rateType }),
        ...(dto.baseCost !== undefined && {
          baseCost: new Prisma.Decimal(dto.baseCost),
        }),
        ...(dto.perKgCost !== undefined && {
          perKgCost: new Prisma.Decimal(dto.perKgCost),
        }),
        ...(dto.freeShippingMinimum !== undefined && {
          freeShippingMinimum:
            dto.freeShippingMinimum != null
              ? new Prisma.Decimal(dto.freeShippingMinimum)
              : null,
        }),
        ...(dto.estimatedMinDays !== undefined && {
          estimatedMinDays: dto.estimatedMinDays,
        }),
        ...(dto.estimatedMaxDays !== undefined && {
          estimatedMaxDays: dto.estimatedMaxDays,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        deliveryZone: { select: { id: true, name: true, slug: true } },
        courier: { select: { id: true, name: true, slug: true, logo: true } },
      },
    });

    this.logger.log(`Shipping rule updated: ${id} by ${updatedBy}`);
    return rule;
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.softDelete('shippingRule', id, deletedBy);
    this.logger.log(`Shipping rule deleted: ${id} by ${deletedBy}`);
  }

  /**
   * Calculate available shipping options for a cart.
   * Called by CheckoutService.
   */
  async calculateShippingOptions(
    input: ShippingCalculationInput,
  ): Promise<ShippingOption[]> {
    const rules = await this.prisma.shippingRule.findMany({
      where: {
        deliveryZoneId: input.deliveryZoneId,
        deletedAt: null,
        isActive: true,
        ...(input.courierId && { courierId: input.courierId }),
        courier: { isActive: true, deletedAt: null },
      },
      include: {
        courier: { select: { id: true, name: true, logo: true } },
      },
    });

    return rules
      .map((rule) => {
        const baseCost = rule.baseCost.toNumber();
        const perKgCost = rule.perKgCost.toNumber();
        const freeMinimum = rule.freeShippingMinimum?.toNumber();

        // Free shipping threshold
        if (freeMinimum != null && input.cartTotal >= freeMinimum) {
          return {
            courierId: rule.courierId,
            courierName: rule.courier.name,
            courierLogo: rule.courier.logo,
            ruleId: rule.id,
            baseCost,
            totalCost: 0,
            estimatedMinDays: rule.estimatedMinDays,
            estimatedMaxDays: rule.estimatedMaxDays,
            isFree: true,
          };
        }

        let totalCost = baseCost;
        if (rule.rateType === 'WEIGHT_BASED' && input.totalWeight) {
          totalCost += perKgCost * input.totalWeight;
        } else if (rule.rateType === 'ITEM_BASED' && input.itemCount) {
          totalCost += perKgCost * input.itemCount;
        }

        return {
          courierId: rule.courierId,
          courierName: rule.courier.name,
          courierLogo: rule.courier.logo,
          ruleId: rule.id,
          baseCost,
          totalCost: parseFloat(totalCost.toFixed(2)),
          estimatedMinDays: rule.estimatedMinDays,
          estimatedMaxDays: rule.estimatedMaxDays,
          isFree: false,
        };
      })
      .sort((a, b) => a.totalCost - b.totalCost);
  }
}
