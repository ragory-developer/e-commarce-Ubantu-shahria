import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class TagTranslationDto {
  @ApiPropertyOptional({ example: 'ইলেকট্রনিক্স' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateTagDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'electronics',
    description: 'URL friendly slug',
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
      bn: { name: 'ইলেকট্রনিক্স' },
      ar: { name: 'إلكترونيات' },
    },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => TagTranslationDto)
  translations?: Record<string, TagTranslationDto>;
}
