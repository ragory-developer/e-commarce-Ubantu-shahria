// ─── src/attribute/dto/create-attribute-set.dto.ts ──────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateAttributeSetDto {
  @ApiProperty({
    example: 'Laptop Specifications',
    description: 'Display name of the attribute set',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'laptop-specifications',
    description: 'URL-friendly slug',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug!: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Translations in multiple languages',
    example: {
      bn: { name: 'ল্যাপটপ বৈশিষ্ট্য' },
      ar: { name: 'مواصفات الكمبيوتر المحمول' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
