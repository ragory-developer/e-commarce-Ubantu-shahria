// ─── src/product/dto/create-product.dto.ts ────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsEnum,
  IsArray,
  IsObject,
  Min,
  MaxLength,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { VariationType, SpecialPriceType } from '@prisma/client';

// ─── Nested DTOs ──────────────────────────────────────────────

export class ProductSeoDto {
  @ApiPropertyOptional({ example: 'custom-url-slug' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  url?: string;

  @ApiPropertyOptional({ example: 'Buy T-Shirt Online' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Best cotton t-shirt...' })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}

export class ProductAttributeItemDto {
  @ApiProperty({ example: 'clx_attr_001' })
  @IsString()
  @IsNotEmpty()
  attributeId!: string;

  @ApiProperty({ example: ['clx_val_001', 'clx_val_002'] })
  @IsArray()
  @IsString({ each: true })
  attributeValueIds!: string[];
}

export class VariationValueItemDto {
  @ApiPropertyOptional({
    example: 'clx_val_001',
    description: 'Existing variation value ID',
  })
  @IsOptional()
  @IsString()
  variationValueId?: string;

  @ApiProperty({ example: 'XL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  label!: string;

  @ApiPropertyOptional({ example: '#ff0000' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  value?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class ProductVariationItemDto {
  @ApiPropertyOptional({
    example: 'clx_var_001',
    description: 'Existing global variation ID',
  })
  @IsOptional()
  @IsString()
  variationId?: string;

  @ApiProperty({ example: 'size' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ enum: VariationType, example: 'TEXT' })
  @IsEnum(VariationType)
  type!: VariationType;

  @ApiProperty({ type: [VariationValueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationValueItemDto)
  values!: VariationValueItemDto[];
}

export class ProductVariantItemDto {
  @ApiProperty({ example: 'xl / red' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name!: string;

  @ApiPropertyOptional({ example: 'TSHIRT-XL-RED' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialPrice?: number;

  @ApiPropertyOptional({ enum: SpecialPriceType, example: 'FIXED' })
  @IsOptional()
  @IsEnum(SpecialPriceType)
  specialPriceType?: SpecialPriceType;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  specialPriceStart?: string;

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  specialPriceEnd?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    example: ['clx_media_001', 'clx_media_002'],
    description: 'Media IDs for variant images (linked via EntityMedia)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}

// ─── Main DTO ─────────────────────────────────────────────────

export class CreateProductDto {
  // ─── General ──────────────────────────────────────────────
  @ApiProperty({ example: 'Classic T-Shirt' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: '<p>Premium cotton t-shirt</p>' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ example: 'Premium cotton t-shirt' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'clx_brand_001' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ example: 'clx_tax_001' })
  @IsOptional()
  @IsString()
  taxClassId?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ─── Categories & Tags ────────────────────────────────────
  @ApiPropertyOptional({ example: ['clx_cat_001', 'clx_cat_002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: ['clx_tag_001'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  // ─── Attributes ───────────────────────────────────────────
  @ApiPropertyOptional({ type: [ProductAttributeItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeItemDto)
  attributes?: ProductAttributeItemDto[];

  // ─── Variations ───────────────────────────────────────────
  @ApiPropertyOptional({ type: [ProductVariationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariationItemDto)
  variations?: ProductVariationItemDto[];

  // ─── Variants ─────────────────────────────────────────────
  @ApiPropertyOptional({ type: [ProductVariantItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantItemDto)
  variants?: ProductVariantItemDto[];

  // ─── Global Pricing (when NO variants) ────────────────────
  @ApiPropertyOptional({ example: 29.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 24.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialPrice?: number;

  @ApiPropertyOptional({ enum: SpecialPriceType, example: 'FIXED' })
  @IsOptional()
  @IsEnum(SpecialPriceType)
  specialPriceType?: SpecialPriceType;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  specialPriceStart?: string;

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  specialPriceEnd?: string;

  // ─── Global Inventory (when NO variants) ──────────────────
  @ApiPropertyOptional({ example: 'TSHIRT-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  // ─── Global Media (when NO variants) — via EntityMedia ────
  @ApiPropertyOptional({
    example: ['clx_media_001', 'clx_media_002'],
    description: 'Media IDs for product images (linked via EntityMedia)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({
    example: 'clx_media_001',
    description: 'Main/thumbnail media ID',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;

  // ─── SEO ──────────────────────────────────────────────────
  @ApiPropertyOptional({ type: ProductSeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSeoDto)
  seo?: ProductSeoDto;

  // ─── Additional ───────────────────────────────────────────
  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  newFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  newTo?: string;

  // ─── Linked Products ──────────────────────────────────────
  @ApiPropertyOptional({ example: ['clx_prod_001'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedProductIds?: string[];

  @ApiPropertyOptional({ example: ['clx_prod_002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  upSellProductIds?: string[];

  @ApiPropertyOptional({ example: ['clx_prod_003'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  crossSellProductIds?: string[];
}
