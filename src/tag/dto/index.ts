// ─── src/tag/dto/index.ts ─────────────────────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  IsInt,
  Min,
  Max,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// CREATE TAG DTO
// ─────────────────────────────────────────────────────────────
export class CreateTagDto {
  @ApiProperty({
    example: 'Electronics',
    description: 'Tag display name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tag name is required' })
  @MaxLength(191, { message: 'Tag name must not exceed 191 characters' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'electronics',
    description: 'URL-friendly slug (auto-generated if not provided)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @MaxLength(191, { message: 'Slug must not exceed 191 characters' })
  @Transform(({ value }) =>
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
  slug!: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Multi-language translations keyed by locale',
    example: {
      bn: { name: 'ইলেকট্রনিক্স' },
      ar: { name: 'إلكترونيات' },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Translations must be a valid JSON object' })
  translations?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────
// UPDATE TAG DTO
// ─────────────────────────────────────────────────────────────
export class UpdateTagDto extends PartialType(CreateTagDto) {}

// ─────────────────────────────────────────────────────────────
// LIST TAGS DTO
// ─────────────────────────────────────────────────────────────
export class ListTagsDto {
  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Records to skip (pagination)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Records per page (max 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;

  @ApiPropertyOptional({
    example: 'electronics',
    description: 'Search by name or slug',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'name',
    enum: ['name', 'slug', 'createdAt', 'productCount'],
    description: 'Sort field',
  })
  @IsOptional()
  @IsIn(['name', 'slug', 'createdAt', 'productCount'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    example: 'desc',
    enum: ['asc', 'desc'],
    description: 'Sort direction',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─────────────────────────────────────────────────────────────
// BULK DELETE DTO
// ─────────────────────────────────────────────────────────────
export class BulkDeleteTagsDto {
  @ApiProperty({
    example: ['clx_tag_001', 'clx_tag_002'],
    description: 'Array of tag IDs to delete',
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];
}
