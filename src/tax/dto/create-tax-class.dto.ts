// ─── src/tax/dto/create-tax-class.dto.ts ──────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsObject,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxBasedOn } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateTaxClassDto {
  @ApiProperty({
    description: 'Unique name for the tax class',
    example: 'Standard Tax',
    minLength: 2,
    maxLength: 191,
  })
  @IsString()
  @IsNotEmpty({ message: 'Tax class name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(191, { message: 'Name must not exceed 191 characters' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiPropertyOptional({
    description:
      'Determines which address to use for tax calculation: billing address, shipping address, or store address',
    enum: TaxBasedOn,
    default: TaxBasedOn.SHIPPING_ADDRESS,
    example: TaxBasedOn.SHIPPING_ADDRESS,
  })
  @IsOptional()
  @IsEnum(TaxBasedOn, {
    message:
      'basedOn must be one of: BILLING_ADDRESS, SHIPPING_ADDRESS, or STORE_ADDRESS',
  })
  basedOn?: TaxBasedOn = TaxBasedOn.SHIPPING_ADDRESS;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Internationalization translations for the tax class name. Format: { "locale": { "name": "translated name" } }',
    example: {
      bn: { name: 'স্ট্যান্ডার্ড ট্যাক্স' },
      ar: { name: 'الضريبة القياسية' },
      es: { name: 'Impuesto Estándar' },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Translations must be a valid JSON object' })
  @ValidateNested({ each: true })
  translations?: Record<string, { name: string }>;
}
