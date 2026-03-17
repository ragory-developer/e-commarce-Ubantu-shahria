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

class BrandSeoDto {
  @ApiPropertyOptional({ example: 'Samsung - Official Store' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Shop Samsung products...' })
  @IsOptional()
  @IsString()
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

// class BrandTranslationDto {
//   @ApiPropertyOptional({ example: 'স্যামসাং' })
//   @IsOptional()
//   @IsString()
//   name?: string;

//   @ApiPropertyOptional({ example: 'বিশ্বস্ত ইলেকট্রনিক্স ব্র্যান্ড' })
//   @IsOptional()
//   @IsString()
//   description?: string;
// }

export class CreateBrandDto {
  @ApiProperty({ example: 'Samsung' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'samsung', description: 'URL-friendly slug' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug!: string;

  @ApiPropertyOptional({ example: 'Leading electronics brand worldwide' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'media_id_123',
    description: 'Media ID from media upload',
  })
  @IsOptional()
  @IsString()
  image?: string;

  // @ApiPropertyOptional({
  //   type: Object,
  //   description: 'Translations in different languages',
  //   additionalProperties: {
  //     type: () => BrandTranslationDto,
  //   },
  //   example: {
  //     bn: { name: 'স্যামসাং', description: 'বিশ্ব ব্র্যান্ড' },
  //     ar: { name: 'سامسونج', description: 'علامة تجارية معروفة' },
  //   },
  // })
  // @IsOptional()
  // @IsObject()
  // translations?: Record<string, BrandTranslationDto>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Translations stored as raw JSON (temporary)',
    example: {
      bn: { name: 'স্যামসাং', description: 'বিশ্ব ব্র্যান্ড' },
      ar: { name: 'سامسونج', description: 'علامة تجارية معروفة' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;

  @ApiPropertyOptional({
    type: BrandSeoDto,
    description: 'SEO metadata',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandSeoDto)
  seo?: BrandSeoDto;
}
