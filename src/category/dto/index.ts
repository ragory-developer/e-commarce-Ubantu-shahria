// ─── src/category/dto/index.ts ────────────────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  IsBoolean,
  ValidateNested,
  IsInt,
  Min,
  IsArray,
  IsIn,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// NESTED: SEO
// ─────────────────────────────────────────────────────────────
export class CategorySeoDto {
  @ApiPropertyOptional({ example: 'Electronics - Best Deals Online' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({
    example: 'Shop top electronics at unbeatable prices.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/electronics-og.jpg',
  })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({ example: '/categories/electronics' })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;
}

// ─────────────────────────────────────────────────────────────
// CREATE CATEGORY DTO
// ─────────────────────────────────────────────────────────────
export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'electronics' })
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

  @ApiPropertyOptional({ example: 'All electronics and gadgets.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'clx_cat_abc123',
    description: 'Parent category ID — omit or null for root',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  parentId?: string;

  @ApiPropertyOptional({
    example: 'clx_media_img123',
    description: 'Thumbnail image media ID',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  image?: string;

  @ApiPropertyOptional({
    example: 'clx_media_icon123',
    description: 'Icon media ID',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  icon?: string;

  @ApiPropertyOptional({
    example: 'clx_media_banner123',
    description: 'Banner image media ID',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  bannerImage?: string;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Sort position within parent',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: Object,
    example: {
      bn: { name: 'ইলেকট্রনিক্স', description: 'সকল ইলেকট্রনিক পণ্য' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;

  @ApiPropertyOptional({ type: CategorySeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CategorySeoDto)
  seo?: CategorySeoDto;
}

// ─────────────────────────────────────────────────────────────
// UPDATE CATEGORY DTO
// ─────────────────────────────────────────────────────────────
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

// ─────────────────────────────────────────────────────────────
// MOVE CATEGORY DTO
// ─────────────────────────────────────────────────────────────
export class MoveCategoryDto {
  @ApiPropertyOptional({
    example: 'clx_cat_parent123',
    description: 'New parent ID. Pass null or omit to move to root.',
  })
  @IsOptional()
  @IsString()
  newParentId?: string | null;

  @ApiPropertyOptional({
    example: 0,
    description: 'Position within new parent',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

// ─────────────────────────────────────────────────────────────
// REORDER CATEGORIES DTO
// ─────────────────────────────────────────────────────────────
export class ReorderItemDto {
  @ApiProperty({ example: 'clx_cat_001' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];

  @ApiPropertyOptional({
    example: 'clx_cat_parent',
    description: 'Parent ID to scope reorder within (null = root level)',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

// ─────────────────────────────────────────────────────────────
// LIST CATEGORIES DTO
// ─────────────────────────────────────────────────────────────
export class ListCategoriesDto {
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

  @ApiPropertyOptional({ example: 'electronics' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'clx_cat_parent',
    description: 'Filter by parent ID',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Show only root categories (depth 0)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  rootOnly?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'position',
    enum: ['name', 'slug', 'position', 'createdAt', 'depth'],
  })
  @IsOptional()
  @IsIn(['name', 'slug', 'position', 'createdAt', 'depth'])
  sortBy?: string = 'position';

  @ApiPropertyOptional({ example: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
