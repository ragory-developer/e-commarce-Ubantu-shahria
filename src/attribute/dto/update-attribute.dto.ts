import {
  IsString,
  IsOptional,
  MaxLength,
  IsObject,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class UpdateAttributeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug?: string;

  @ApiPropertyOptional({
    enum: [
      'TEXT',
      'NUMBER',
      'SELECT',
      'MULTI_SELECT',
      'COLOR_PICKER',
      'CHECKBOX',
      'DATE_PICKER',
    ],
  })
  @IsOptional()
  @IsEnum([
    'TEXT',
    'NUMBER',
    'SELECT',
    'MULTI_SELECT',
    'COLOR_PICKER',
    'CHECKBOX',
    'DATE_PICKER',
  ])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
