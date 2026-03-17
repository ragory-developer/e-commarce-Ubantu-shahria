// ─── src/variation/dto/create-variation-value.dto.ts ──────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateVariationValueDto {
  @ApiProperty({ example: 'XL', description: 'Display label for this value' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  label!: string;

  @ApiPropertyOptional({
    example: '#ff0000',
    description: 'Hex color for COLOR type, image URL for IMAGE type',
  })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  value?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ type: Object, example: { bn: { label: 'এক্সএল' } } })
  @IsOptional()
  @IsObject()
  translations?: object;
}
