import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
// import { AttributeType } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { AttributeType } from '@prisma/client';

export class CreateAttributeDto {
  @ApiProperty({
    example: 'clx_attribute_set_123',
    description: 'ID of the attribute set this attribute belongs to',
  })
  @IsString()
  @IsNotEmpty()
  attributeSetId!: string;

  @ApiProperty({
    example: 'Brand',
    description: 'Attribute name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'brand',
    description: 'URL-friendly slug',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug!: string;

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
    default: 'TEXT',
    description: 'Type of attribute',
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
  type?: AttributeType;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order position',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    type: Object,
    example: {
      bn: { name: 'ব্র্যান্ড' },
      ar: { name: 'العلامة التجارية' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
