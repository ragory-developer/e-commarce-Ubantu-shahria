// ─── src/variation/dto/update-variation.dto.ts ──────────────���─

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { VariationType } from '@prisma/client';

export class UpdateVariationDto {
  @ApiPropertyOptional({ example: 'Color' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ enum: VariationType, example: 'COLOR' })
  @IsOptional()
  @IsEnum(VariationType)
  type?: VariationType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @ApiPropertyOptional({ example: 1 })
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
