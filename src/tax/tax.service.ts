// ─── src/tax/tax.service.ts ───────────────────────────────────

import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TaxBasedOn } from '@prisma/client';
import {
  CreateTaxClassDto,
  UpdateTaxClassDto,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  ListTaxClassesDto,
  ListTaxRatesDto,
} from './dto';

// ─── Tax Calculation Types ────────────────────────────────────

export interface TaxLineInput {
  productId: string;
  taxClassId: string | null;
  lineTotal: number; // subtotal for this line (unitPrice × qty)
}

export interface TaxCalculationResult {
  taxTotal: number;
  taxBreakdown: Array<{
    taxRateId: string;
    rateName: string;
    rateValue: number; // e.g. 15.0000
    amount: number; // calculated tax amount
  }>;
}

export interface AddressForTax {
  country: string;
  state?: string;
  city?: string;
  zip?: string;
}

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // TAX CLASS CRUD
  // ══════════════════════════════════════════════════════════════

  /**
   * Create a new tax class
   * @throws ConflictException if tax class with same name already exists
   */
  async createTaxClass(dto: CreateTaxClassDto) {
    // Check for duplicate name
    const existing = await this.prisma.taxClass.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Tax class with name "${dto.name}" already exists`,
      );
    }

    return this.prisma.taxClass.create({
      data: {
        name: dto.name,
        basedOn: dto.basedOn ?? TaxBasedOn.SHIPPING_ADDRESS,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        rates: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  /**
   * List all tax classes with optional filtering and pagination
   */
  async findAllTaxClasses(dto: ListTaxClassesDto) {
    const where: Prisma.TaxClassWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        name: { contains: dto.search, mode: 'insensitive' as const },
      }),
      ...(dto.basedOn && { basedOn: dto.basedOn }),
    };

    const [data, total] = await Promise.all([
      this.prisma.taxClass.findMany({
        where,
        include: {
          rates: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
          },
          ...(dto.includeProductCount && {
            _count: { select: { products: true } },
          }),
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.taxClass.count({ where }),
    ]);

    return {
      data,
      total,
      meta: {
        skip: dto.skip ?? 0,
        take: dto.take ?? 50,
        hasMore: (dto.skip ?? 0) + (dto.take ?? 50) < total,
      },
    };
  }

  /**
   * Get a single tax class by ID
   * @throws NotFoundException if tax class not found
   */
  async findOneTaxClass(id: string) {
    const taxClass = await this.prisma.taxClass.findFirst({
      where: { id, deletedAt: null },
      include: {
        rates: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });

    if (!taxClass) {
      throw new NotFoundException(`Tax class with ID "${id}" not found`);
    }

    return taxClass;
  }

  /**
   * Update a tax class
   * @throws NotFoundException if tax class not found
   * @throws ConflictException if new name conflicts with existing tax class
   */
  async updateTaxClass(id: string, dto: UpdateTaxClassDto) {
    await this.findOneTaxClass(id);

    // Check for duplicate name if name is being changed
    if (dto.name) {
      const existing = await this.prisma.taxClass.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Tax class with name "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.taxClass.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.basedOn !== undefined && { basedOn: dto.basedOn }),
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
      },
      include: {
        rates: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  /**
   * Soft delete a tax class
   * @throws NotFoundException if tax class not found
   * @throws BadRequestException if tax class is in use by products
   */
  async removeTaxClass(id: string, deletedBy: string) {
    const taxClass = await this.findOneTaxClass(id);

    // Check if tax class is being used by any products
    const productCount = await this.prisma.product.count({
      where: { taxClassId: id, deletedAt: null },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete tax class "${taxClass.name}" because it is currently used by ${productCount} product(s). Please reassign or remove these products first.`,
      );
    }

    await this.prisma.softDelete('taxClass', id, deletedBy);
  }

  // ══════════════════════════════════════════════════════════════
  // TAX RATE CRUD
  // ══════════════════════════════════════════════════════════════

  /**
   * Create a new tax rate
   * @throws NotFoundException if tax class not found
   * @throws ConflictException if duplicate tax rate exists for same location
   */
  async createTaxRate(dto: CreateTaxRateDto) {
    await this.findOneTaxClass(dto.taxClassId);

    // Check for duplicate tax rate for same location
    const duplicate = await this.findDuplicateTaxRate(
      dto.taxClassId,
      dto.country,
      dto.state ?? '*',
      dto.city ?? '*',
      dto.zip ?? '*',
    );

    if (duplicate) {
      throw new ConflictException(
        this.buildDuplicateTaxRateMessage(dto, duplicate),
      );
    }

    return this.prisma.taxRate.create({
      data: {
        taxClassId: dto.taxClassId,
        name: dto.name,
        country: dto.country.toUpperCase(),
        state: dto.state ?? '*',
        city: dto.city ?? '*',
        zip: dto.zip ?? '*',
        rate: new Prisma.Decimal(dto.rate),
        position: dto.position ?? 0,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        taxClass: {
          select: {
            id: true,
            name: true,
            basedOn: true,
          },
        },
      },
    });
  }

  /**
   * List all tax rates with optional filtering
   */
  async findAllTaxRates(dto: ListTaxRatesDto) {
    const where: Prisma.TaxRateWhereInput = {
      deletedAt: null,
      ...(dto.taxClassId && { taxClassId: dto.taxClassId }),
      ...(dto.search && {
        name: { contains: dto.search, mode: 'insensitive' as const },
      }),
      ...(dto.country && { country: dto.country.toUpperCase() }),
      ...(dto.state && { state: dto.state }),
    };

    const [data, total] = await Promise.all([
      this.prisma.taxRate.findMany({
        where,
        include: {
          taxClass: {
            select: {
              id: true,
              name: true,
              basedOn: true,
            },
          },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.taxRate.count({ where }),
    ]);

    return {
      data,
      total,
      meta: {
        skip: dto.skip ?? 0,
        take: dto.take ?? 50,
        hasMore: (dto.skip ?? 0) + (dto.take ?? 50) < total,
      },
    };
  }

  /**
   * Get a single tax rate by ID
   * @throws NotFoundException if tax rate not found
   */
  async findOneTaxRate(id: string) {
    const taxRate = await this.prisma.taxRate.findFirst({
      where: { id, deletedAt: null },
      include: {
        taxClass: {
          select: {
            id: true,
            name: true,
            basedOn: true,
          },
        },
      },
    });

    if (!taxRate) {
      throw new NotFoundException(`Tax rate with ID "${id}" not found`);
    }

    return taxRate;
  }

  /**
   * Update a tax rate
   * @throws NotFoundException if tax rate not found
   * @throws ConflictException if update would create duplicate
   */
  async updateTaxRate(id: string, dto: UpdateTaxRateDto) {
    const existing = await this.findOneTaxRate(id);

    // Check for duplicates if location fields are being changed
    if (dto.country || dto.state || dto.city || dto.zip) {
      const duplicate = await this.findDuplicateTaxRate(
        existing.taxClassId,
        dto.country ?? existing.country,
        dto.state ?? existing.state,
        dto.city ?? existing.city,
        dto.zip ?? existing.zip,
        id, // exclude current record
      );

      if (duplicate) {
        throw new ConflictException(
          `A tax rate already exists for this location in tax class "${duplicate.taxClass.name}"`,
        );
      }
    }

    return this.prisma.taxRate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.country !== undefined && {
          country: dto.country.toUpperCase(),
        }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.zip !== undefined && { zip: dto.zip }),
        ...(dto.rate !== undefined && { rate: new Prisma.Decimal(dto.rate) }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.translations !== undefined && {
          translations: dto.translations as Prisma.InputJsonValue,
        }),
      },
      include: {
        taxClass: {
          select: {
            id: true,
            name: true,
            basedOn: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a tax rate
   * @throws NotFoundException if tax rate not found
   */
  async removeTaxRate(id: string, deletedBy: string) {
    await this.findOneTaxRate(id);
    await this.prisma.softDelete('taxRate', id, deletedBy);
  }

  // ══════════════════════════════════════════════════════════════
  // CORE: CALCULATE TAX FOR ORDER
  // ══════════════════════════════════════════════════════════════

  /**
   * Calculate tax for an order based on line items and addresses
   *
   * Algorithm:
   * 1. Group line items by taxClassId
   * 2. For each tax class, determine address (based on TaxClass.basedOn)
   * 3. Find matching TaxRates for that address
   * 4. Apply rates to line totals
   * 5. Return total tax + breakdown for OrderTax records
   *
   * @param lines - Array of line items with tax class and total
   * @param shippingAddress - Customer's shipping address
   * @param billingAddress - Customer's billing address
   * @returns Tax total and breakdown by rate
   */
  async calculateTax(
    lines: TaxLineInput[],
    shippingAddress: AddressForTax,
    billingAddress: AddressForTax,
  ): Promise<TaxCalculationResult> {
    const breakdown: TaxCalculationResult['taxBreakdown'] = [];
    let taxTotal = 0;

    // Group lines by taxClassId
    const linesByTaxClass = new Map<string, number>();
    for (const line of lines) {
      if (!line.taxClassId) continue; // no tax class = tax-exempt
      const current = linesByTaxClass.get(line.taxClassId) ?? 0;
      linesByTaxClass.set(line.taxClassId, current + line.lineTotal);
    }

    if (linesByTaxClass.size === 0) {
      return { taxTotal: 0, taxBreakdown: [] };
    }

    // Load tax classes with their rates
    const taxClassIds = Array.from(linesByTaxClass.keys());
    const taxClasses = await this.prisma.taxClass.findMany({
      where: { id: { in: taxClassIds }, deletedAt: null },
      include: {
        rates: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });

    for (const taxClass of taxClasses) {
      const lineTotal = linesByTaxClass.get(taxClass.id) ?? 0;
      if (lineTotal <= 0) continue;

      // Determine which address to use
      const address =
        taxClass.basedOn === TaxBasedOn.BILLING_ADDRESS
          ? billingAddress
          : shippingAddress;

      // Find matching rates (most specific first)
      const matchingRates = this.findMatchingRates(taxClass.rates, address);

      for (const rate of matchingRates) {
        const rateValue = rate.rate.toNumber();
        const amount = parseFloat(((lineTotal * rateValue) / 100).toFixed(4));

        breakdown.push({
          taxRateId: rate.id,
          rateName: rate.name,
          rateValue,
          amount,
        });

        taxTotal += amount;
      }
    }

    this.logger.log(
      `Tax calculation completed: ${breakdown.length} rates applied, total: ${taxTotal}`,
    );

    return {
      taxTotal: parseFloat(taxTotal.toFixed(4)),
      taxBreakdown: breakdown,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ══════════════════════════════════════════════════════════════

  /**
   * Find matching tax rates for a given address
   * Priority: exact country+state+city+zip > country+state+city > country+state > country > wildcard
   */
  private findMatchingRates(
    rates: Array<{
      id: string;
      country: string;
      state: string;
      city: string;
      zip: string;
      rate: Prisma.Decimal;
      name: string;
    }>,
    address: AddressForTax,
  ) {
    return rates.filter((rate) => {
      const countryMatch =
        rate.country === '*' ||
        rate.country.toUpperCase() === (address.country ?? '').toUpperCase();
      const stateMatch =
        rate.state === '*' ||
        rate.state.toLowerCase() === (address.state ?? '').toLowerCase();
      const cityMatch =
        rate.city === '*' ||
        rate.city.toLowerCase() === (address.city ?? '').toLowerCase();
      const zipMatch = rate.zip === '*' || rate.zip === (address.zip ?? '');

      return countryMatch && stateMatch && cityMatch && zipMatch;
    });
  }

  /**
   * Find duplicate tax rate for the same location
   */
  private async findDuplicateTaxRate(
    taxClassId: string,
    country: string,
    state: string,
    city: string,
    zip: string,
    excludeId?: string,
  ) {
    return this.prisma.taxRate.findFirst({
      where: {
        taxClassId,
        country: country.toUpperCase(),
        state,
        city,
        zip,
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
      include: {
        taxClass: {
          select: { name: true },
        },
      },
    });
  }

  /**
   * Build informative duplicate tax rate error message
   */
  private buildDuplicateTaxRateMessage(
    dto: CreateTaxRateDto,
    duplicate: any,
  ): string {
    const location = this.formatLocation(
      dto.country,
      dto.state,
      dto.city,
      dto.zip,
    );
    return `A tax rate already exists for ${location} in tax class "${duplicate.taxClass.name}". Existing rate: "${duplicate.name}" (${duplicate.rate}%)`;
  }

  /**
   * Format location string for error messages
   */
  private formatLocation(
    country: string,
    state?: string,
    city?: string,
    zip?: string,
  ): string {
    const parts: string[] = [];

    if (country && country !== '*') parts.push(`Country: ${country}`);
    if (state && state !== '*') parts.push(`State: ${state}`);
    if (city && city !== '*') parts.push(`City: ${city}`);
    if (zip && zip !== '*') parts.push(`ZIP: ${zip}`);

    return parts.length > 0 ? parts.join(', ') : 'all locations';
  }
}
