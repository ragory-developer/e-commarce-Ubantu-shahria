// ─── src/brand/dto/index.ts ───────────────────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// NESTED: SEO DTO
// ─────────────────────────────────────────────────────────────
export class BrandSeoDto {
  @ApiPropertyOptional({ example: 'Samsung - Official Electronics Store' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Shop Samsung smartphones, TVs and more.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/samsung-og.jpg' })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({ example: '/brands/samsung' })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;
}

// ─────────────────────────────────────────────────────────────
// CREATE BRAND DTO
// ─────────────────────────────────────────────────────────────
export class CreateBrandDto {
  @ApiProperty({ example: 'Samsung', description: 'Brand display name' })
  @IsString()
  @IsNotEmpty({ message: 'Brand name is required' })
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'samsung', description: 'URL-friendly slug' })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @MaxLength(191)
  @Transform(({ value }) =>
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
  slug!: string;

  @ApiPropertyOptional({ example: 'Leading global electronics manufacturer.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'clx_media_123',
    description: 'Media ID of the brand logo image',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Multi-language translations',
    example: {
      bn: { name: 'স্যামসাং', description: 'বিশ্বস্ত ইলেকট্রনিক্স ব্র্যান্ড' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;

  @ApiPropertyOptional({ type: BrandSeoDto, description: 'SEO metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandSeoDto)
  seo?: BrandSeoDto;
}

// ─────────────────────────────────────────────────────────────
// UPDATE BRAND DTO
// ─────────────────────────────────────────────────────────────
export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

// ─────────────────────────────────────────────────────────────
// LIST BRANDS DTO
// ─────────────────────────────────────────────────────────────
export class ListBrandsDto {
  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;

  @ApiPropertyOptional({
    example: 'samsung',
    description: 'Search by name or slug',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'name',
    enum: ['name', 'slug', 'createdAt', 'productCount'],
  })
  @IsOptional()
  @IsIn(['name', 'slug', 'createdAt', 'productCount'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─────────────────────────────────────────────────────────────
// BULK DELETE DTO
// ─────────────────────────────────────────────────────────────
export class BulkDeleteBrandsDto {
  @ApiProperty({ example: ['clx_brand_001', 'clx_brand_002'] })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];
}
