// src/attribute/dto/index.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { AttributeType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// ATTRIBUTE SET DTOs
// ─────────────────────────────────────────────────────────────

export class CreateAttributeSetDto {
  @ApiProperty({ example: 'Laptop Specifications' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'laptop-specifications' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
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
    example: { bn: { name: 'ল্যাপটপ বৈশিষ্ট্য' } },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

export class UpdateAttributeSetDto extends PartialType(CreateAttributeSetDto) {}

export class ListAttributeSetsDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// ─────────────────────────────────────────────────────────────
// ATTRIBUTE DTOs
// ─────────────────────────────────────────────────────────────

export class CreateAttributeDto {
  @ApiProperty({ example: 'clx_attrset_001' })
  @IsString()
  @IsNotEmpty()
  attributeSetId!: string;

  @ApiProperty({ example: 'Processor Brand' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'processor-brand' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) =>
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
  slug!: string;

  @ApiPropertyOptional({
    enum: AttributeType,
    default: 'TEXT',
  })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType = AttributeType.TEXT;

  // Note: Attribute has no position field in schema

  @ApiPropertyOptional({
    type: Object,
    example: { bn: { name: 'প্রসেসর ব্র্যান্ড' } },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

// Using a plain class approach to avoid decorator-in-class-expression issues
export class UpdateAttributeDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug?: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  // No position in Attribute schema

  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

export class ListAttributesDto {
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

  @ApiPropertyOptional({ description: 'Filter by attribute set ID' })
  @IsOptional()
  @IsString()
  attributeSetId?: string;

  @ApiPropertyOptional({ enum: AttributeType })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['name', 'slug', 'createdAt'] })
  @IsOptional()
  @IsIn(['name', 'slug', 'createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// ─────────────────────────────────────────────────────────────
// ATTRIBUTE VALUE DTOs
// ─────────────────────────────────────────────────────────────

export class AttributeValueItemDto {
  @ApiProperty({ example: 'Intel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  value!: string;

  @ApiPropertyOptional({ example: 'Intel Corporation' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  label?: string;

  @ApiPropertyOptional({ example: '#FF0000' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  hexColor?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

export class AddAttributeValuesDto {
  @ApiProperty({
    type: [AttributeValueItemDto],
    description: 'Values to add. Duplicates are skipped.',
    example: [{ value: 'Intel' }, { value: 'AMD' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueItemDto)
  values!: AttributeValueItemDto[];
}

export class UpdateAttributeValueItemDto {
  @ApiProperty({ example: 'clx_av_001' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional({ example: 'Intel' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  value?: string;

  @ApiPropertyOptional({ example: 'Intel Corporation' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  label?: string;

  @ApiPropertyOptional({ example: '#FF0000' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  hexColor?: string;

  // No position in AttributeValue schema

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

export class UpdateAttributeValuesDto {
  @ApiProperty({ type: [UpdateAttributeValueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAttributeValueItemDto)
  values!: UpdateAttributeValueItemDto[];
}

export class ReorderAttributeValuesDto {
  @ApiProperty({
    type: [Object],
    example: [{ id: 'clx_av_001' }, { id: 'clx_av_002' }],
    description:
      'Order of value IDs (position not used - schema does not have position)',
  })
  @IsArray()
  items!: { id: string }[];
}
