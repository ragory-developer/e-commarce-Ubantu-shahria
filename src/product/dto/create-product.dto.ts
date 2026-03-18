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

  @ApiPropertyOptional({ example: 'https://cdn.example.com/og.jpg' })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({ example: '/products/classic-t-shirt' })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;
}

export class ProductAttributeItemDto {
  @ApiProperty({ example: 'clx_attr_001' })
  @IsString()
  @IsNotEmpty()
  attributeId!: string;

  @ApiProperty({
    example: ['clx_val_001', 'clx_val_002'],
    description: 'Array of attribute value IDs',
  })
  @IsArray()
  @IsString({ each: true })
  attributeValueIds!: string[];
}

export class VariationValueItemDto {
  @ApiPropertyOptional({
    example: 'clx_val_001',
    description: 'Existing variation value ID (skip creating new one)',
  })
  @IsOptional()
  @IsString()
  variationValueId?: string;

  @ApiProperty({ example: 'XL', description: 'Label displayed to users' })
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
    description: 'Use existing global variation ID instead of creating new one',
  })
  @IsOptional()
  @IsString()
  variationId?: string;

  @ApiProperty({
    example: 'Size',
    description: 'Variation name (e.g. Color, Size)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    enum: VariationType,
    example: 'TEXT',
    description: 'TEXT | COLOR | IMAGE | DROPDOWN',
  })
  @IsEnum(VariationType)
  type!: VariationType;

  @ApiProperty({
    type: [VariationValueItemDto],
    description: 'Values for this variation',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationValueItemDto)
  values!: VariationValueItemDto[];
}

export class ProductVariantItemDto {
  @ApiProperty({
    example: 'XL / Red',
    description: 'Variant name — typically combination of variation values',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiPropertyOptional({ example: 'TSHIRT-XL-RED' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: 'BARCODE-123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @ApiPropertyOptional({ example: 30.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 25.0 })
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

  @ApiPropertyOptional({
    example: 5,
    description: 'Alert when qty drops below this',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: 0.5, description: 'Weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

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
    description: 'Media IDs for variant images. Linked via EntityMedia table.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({
    example: 'clx_media_001',
    description: 'Main/thumbnail media ID for this variant',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;
}

// ─── Main DTO ─────────────────────────────────────────────────

export class CreateProductDto {
  // ─── General ──────────────────────────────────────────────
  @ApiProperty({ example: 'Classic Cotton T-Shirt' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example:
      '<p>Premium 100% cotton t-shirt available in multiple sizes and colors.</p>',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    example: 'Premium cotton t-shirt, soft and comfortable.',
  })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'clx_brand_001', description: 'Brand ID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ example: 'clx_tax_001', description: 'Tax class ID' })
  @IsOptional()
  @IsString()
  taxClassId?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Feature on homepage' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // ─── Categories & Tags ────────────────────────────────────
  @ApiPropertyOptional({
    example: ['clx_cat_001', 'clx_cat_002'],
    description: 'Category IDs. First one becomes primary.',
  })
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
  @ApiPropertyOptional({
    type: [ProductAttributeItemDto],
    description: 'Spec attributes (e.g. Material: Cotton, Fit: Regular)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeItemDto)
  attributes?: ProductAttributeItemDto[];

  // ─── Variations & Variants ────────────────────────────────
  @ApiPropertyOptional({
    type: [ProductVariationItemDto],
    description:
      'Variation definitions (e.g. Size with values S/M/L/XL). Required if product has variants.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariationItemDto)
  variations?: ProductVariationItemDto[];

  @ApiPropertyOptional({
    type: [ProductVariantItemDto],
    description:
      'Concrete variant combinations. If provided, global price/sku/qty are ignored.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantItemDto)
  variants?: ProductVariantItemDto[];

  // ─── Global Pricing (simple products — no variants) ───────
  @ApiPropertyOptional({
    example: 29.99,
    description: 'Base price. Ignored if variants are provided.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 24.99, description: 'Sale/special price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialPrice?: number;

  @ApiPropertyOptional({ enum: SpecialPriceType, example: 'FIXED' })
  @IsOptional()
  @IsEnum(SpecialPriceType)
  specialPriceType?: SpecialPriceType;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description: 'Sale start date',
  })
  @IsOptional()
  @IsDateString()
  specialPriceStart?: string;

  @ApiPropertyOptional({
    example: '2026-01-31T23:59:59Z',
    description: 'Sale end date',
  })
  @IsOptional()
  @IsDateString()
  specialPriceEnd?: string;

  // ─── Global Inventory (simple products — no variants) ─────
  @ApiPropertyOptional({
    example: 'TSHIRT-001',
    description: 'Stock Keeping Unit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: false, description: 'Enable stock tracking' })
  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @ApiPropertyOptional({ example: 100, description: 'Stock quantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    example: 5,
    description: 'Low stock threshold for alerts',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  // ─── Physical dimensions ──────────────────────────────────
  @ApiPropertyOptional({ example: 0.3, description: 'Weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: '30cm' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  length?: string;

  @ApiPropertyOptional({ example: '20cm' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  width?: string;

  @ApiPropertyOptional({ example: '5cm' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  height?: string;

  // ─── Media (multiple images) ──────────────────────────────
  @ApiPropertyOptional({
    example: ['clx_media_001', 'clx_media_002', 'clx_media_003'],
    description:
      'Media IDs for product images. Supports multiple images. Stored in EntityMedia table.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({
    example: 'clx_media_001',
    description: 'Main/thumbnail media ID. Used as the primary display image.',
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

  // ─── "New" badge dates ────────────────────────────────────
  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description: 'Show "New" badge from this date',
  })
  @IsOptional()
  @IsDateString()
  newFrom?: string;

  @ApiPropertyOptional({
    example: '2026-03-01T00:00:00Z',
    description: 'Stop showing "New" badge after this date',
  })
  @IsOptional()
  @IsDateString()
  newTo?: string;

  // ─── Linked Products ──────────────────────────────────────
  @ApiPropertyOptional({
    example: ['clx_prod_001', 'clx_prod_002'],
    description: 'Related product IDs (shown in "You may also like" section)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedProductIds?: string[];

  @ApiPropertyOptional({
    example: ['clx_prod_003'],
    description: 'Up-sell product IDs (premium alternatives)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  upSellProductIds?: string[];

  @ApiPropertyOptional({
    example: ['clx_prod_004'],
    description: 'Cross-sell product IDs (complementary items)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  crossSellProductIds?: string[];

  // ─── Translations ──────────────────────────────────────────
  @ApiPropertyOptional({
    type: Object,
    example: {
      bn: { name: 'ক্লাসিক টি-শার্ট', description: 'প্রিমিয়াম কটন...' },
    },
    description: 'Multi-language translations',
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
