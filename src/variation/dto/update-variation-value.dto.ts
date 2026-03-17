// ─── src/variation/dto/update-variation-value.dto.ts ──────────

import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class UpdateVariationValueDto {
  @ApiPropertyOptional({ example: 'XXL' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  label?: string;

  @ApiPropertyOptional({ example: '#00ff00' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  value?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: object;
}
