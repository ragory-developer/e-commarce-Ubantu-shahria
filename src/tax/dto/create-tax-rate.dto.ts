// ─── src/tax/dto/create-tax-rate.dto.ts ───────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsObject,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateTaxRateDto {
  @ApiProperty({
    description: 'ID of the tax class this rate belongs to',
    example: 'clx_taxclass_001',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tax class ID is required' })
  taxClassId!: string;

  @ApiProperty({
    description: 'Display name for the tax rate',
    example: 'VAT 15%',
    minLength: 2,
    maxLength: 191,
  })
  @IsString()
  @IsNotEmpty({ message: 'Tax rate name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(191, { message: 'Name must not exceed 191 characters' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    description:
      'ISO 3166-1 alpha-2 country code (2 letters, uppercase). Use "*" for all countries.',
    example: 'BD',
    minLength: 1,
    maxLength: 2,
    pattern: '^([A-Z]{2}|\\*)$',
  })
  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  @Matches(/^([A-Z]{2}|\*)$/, {
    message:
      'Country must be a valid ISO 3166-1 alpha-2 code (2 uppercase letters) or "*" for wildcard',
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  country!: string;

  @ApiPropertyOptional({
    description:
      'State/province/region name. Use "*" for all states. Case-insensitive matching.',
    example: 'Dhaka',
    default: '*',
    maxLength: 191,
  })
  @IsOptional()
  @IsString()
  @MaxLength(191, { message: 'State must not exceed 191 characters' })
  @Transform(({ value }) => value?.trim() || '*')
  state?: string = '*';

  @ApiPropertyOptional({
    description:
      'City name. Use "*" for all cities. Case-insensitive matching.',
    example: 'Dhaka',
    default: '*',
    maxLength: 191,
  })
  @IsOptional()
  @IsString()
  @MaxLength(191, { message: 'City must not exceed 191 characters' })
  @Transform(({ value }) => value?.trim() || '*')
  city?: string = '*';

  @ApiPropertyOptional({
    description:
      'Postal/ZIP code. Use "*" for all ZIP codes. Exact matching only.',
    example: '1000',
    default: '*',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'ZIP code must not exceed 20 characters' })
  @Transform(({ value }) => value?.trim() || '*')
  zip?: string = '*';

  @ApiProperty({
    description:
      'Tax rate as a percentage (e.g., 15.0 = 15%). Must be between 0 and 100. Supports up to 4 decimal places.',
    example: 15.0,
    minimum: 0,
    maximum: 100,
    type: 'number',
    format: 'decimal',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'Rate must be a valid number with up to 4 decimal places' },
  )
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(100, { message: 'Tax rate cannot exceed 100%' })
  rate!: number;

  @ApiPropertyOptional({
    description:
      'Display order/priority when multiple rates match. Lower numbers appear first.',
    example: 0,
    default: 0,
    minimum: 0,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Position must be an integer' })
  @Min(0, { message: 'Position cannot be negative' })
  position?: number = 0;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Internationalization translations for the tax rate name. Format: { "locale": { "name": "translated name" } }',
    example: {
      bn: { name: 'ভ্যাট ১৫%' },
      ar: { name: 'ضريبة القيمة المضافة ١٥٪' },
      es: { name: 'IVA 15%' },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Translations must be a valid JSON object' })
  @ValidateNested({ each: true })
  translations?: Record<string, { name: string }>;
}
