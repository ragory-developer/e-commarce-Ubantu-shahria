// ─── src/tax/dto/list-tax.dto.ts ──────────────────────────────

import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { TaxBasedOn } from '@prisma/client';

export class ListTaxClassesDto {
  @ApiPropertyOptional({
    description: 'Search term to filter tax classes by name (case-insensitive)',
    example: 'standard',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tax calculation basis',
    enum: TaxBasedOn,
    example: TaxBasedOn.SHIPPING_ADDRESS,
  })
  @IsOptional()
  @IsEnum(TaxBasedOn)
  basedOn?: TaxBasedOn;

  @ApiPropertyOptional({
    description:
      'Include tax classes with their associated products count. Default: false',
    example: false,
    default: false,
    type: 'boolean',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeProductCount?: boolean = false;

  @ApiPropertyOptional({
    description: 'Number of records to skip for pagination',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return per page',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Take must be at least 1' })
  @Max(100, { message: 'Take cannot exceed 100 records per page' })
  take?: number = 50;
}

export class ListTaxRatesDto {
  @ApiPropertyOptional({
    description: 'Filter tax rates by tax class ID',
    example: 'clx_taxclass_001',
  })
  @IsOptional()
  @IsString()
  taxClassId?: string;

  @ApiPropertyOptional({
    description: 'Search term to filter tax rates by name (case-insensitive)',
    example: 'VAT',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by ISO 3166-1 alpha-2 country code',
    example: 'BD',
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase().trim())
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by state/province/region',
    example: 'Dhaka',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  state?: string;

  @ApiPropertyOptional({
    description: 'Number of records to skip for pagination',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return per page',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;
}
