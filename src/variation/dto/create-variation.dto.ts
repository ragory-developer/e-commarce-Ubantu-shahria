// ─── src/variation/dto/create-variation.dto.ts ────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { VariationType } from '@prisma/client';
import { CreateVariationValueDto } from './create-variation-value.dto';

export class CreateVariationDto {
  @ApiProperty({ example: 'Size', description: 'Variation attribute name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ enum: VariationType, example: 'TEXT' })
  @IsEnum(VariationType)
  type!: VariationType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ type: Object, example: { bn: { name: 'সাইজ' } } })
  @IsOptional()
  @IsObject()
  translations?: object;

  @ApiPropertyOptional({
    type: [CreateVariationValueDto],
    description: 'Create values inline with the variation',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariationValueDto)
  values?: CreateVariationValueDto[];
}
